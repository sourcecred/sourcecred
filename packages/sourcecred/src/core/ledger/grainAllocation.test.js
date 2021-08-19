// @flow

import {random as randomUuid, parser as uuidParser} from "../../util/uuid";
import {
  computeAllocation,
  computeAllocationSpecial,
  type AllocationIdentity,
  _validateAllocationBudget,
} from "./grainAllocation";
import {fromString as nngFromString} from "./nonnegativeGrain";
import {toDiscount} from "./policies/recent";
import {CredGrainView} from "../credGrainView";
import {createTestLedgerFixture} from "../ledger/testUtils";

import {g} from "../ledger/testUtils";
import * as uuid from "../../util/uuid";
import * as GraphUtil from "../credrank/testUtils";
import * as G from "./grain";

describe("core/ledger/grainAllocation", () => {
  // concise helper for grain from a number
  const nng = (x: number) => nngFromString(x.toString());
  // concise helper for an allocation identity
  function aid(
    paid: number,
    cred: $ReadOnlyArray<number>,
    id = randomUuid()
  ): AllocationIdentity {
    return {id: id, paid: nng(paid), cred};
  }
  const immediate = (n: number) => ({
    policyType: "IMMEDIATE",
    budget: nng(n),
    numIntervalsLookback: 1,
  });
  const recent = (n: number, discount: number) => ({
    policyType: "RECENT",
    budget: nng(n),
    discount: toDiscount(discount),
  });
  const balanced = (n: number, lookbackIntervals = 0) => ({
    policyType: "BALANCED",
    budget: nng(n),
    numIntervalsLookback: lookbackIntervals,
  });

  describe("computeAllocation", () => {
    const {ledgerWithActiveIdentities} = createTestLedgerFixture();
    let credGraph;
    let credGrainView;
    const id1 = GraphUtil.participant1.id;
    const id2 = GraphUtil.participant2.id;
    const id3 = GraphUtil.participant3.id;
    const id4 = GraphUtil.participant4.id;

    const emptyLedger = ledgerWithActiveIdentities(id1, id2);

    describe("validation", () => {
      beforeEach(async (done) => {
        credGraph = await GraphUtil.credGraph();
        credGrainView = CredGrainView.fromCredGraphAndLedger(
          credGraph,
          emptyLedger
        );
        done();
      });

      it("errors if there are no identities", () => {
        const thunk = () =>
          computeAllocation(immediate(5), [], credGrainView, 0);
        expect(thunk).toThrowError("must have at least one identity");
      });
      it("errors if the total cred is zero", () => {
        const thunk = () =>
          computeAllocation(immediate(5), [aid(0, [0])], credGrainView, 0);
        expect(thunk).toThrowError("cred is zero");
      });
      it("errors if there's NaN or Infinity in Cred", () => {
        const thunk = () =>
          computeAllocation(immediate(5), [aid(0, [NaN])], credGrainView, 0);
        expect(thunk).toThrowError("invalid cred");
      });
      it("errors if there's inconsistent Cred lengths", () => {
        const i1 = aid(0, [1]);
        const i2 = aid(0, [1, 2]);
        const thunk = () =>
          computeAllocation(immediate(5), [i1, i2], credGrainView, 0);
        expect(thunk).toThrowError("inconsistent cred length");
      });
      it("errors if the receipts don't match the budget", () => {
        const badAllocation = {
          policy: immediate(5),
          id: randomUuid(),
          receipts: [],
        };
        const thunk = () => _validateAllocationBudget(badAllocation);
        expect(thunk).toThrow("has budget of 5 but distributed 0");
      });
    });

    describe("immediate policy", () => {
      let credGrainViewUnbalanced;
      let credGraph2;

      beforeEach(async (done) => {
        credGraph2 = await GraphUtil.credGraph2();
        const unbalancedLedger = ledgerWithActiveIdentities(id3, id4);
        credGrainViewUnbalanced = CredGrainView.fromCredGraphAndLedger(
          credGraph2,
          unbalancedLedger
        );
        done();
      });

      it("splits based on just most recent cred", () => {
        const policy = immediate(1000);
        const i1 = aid(100, [10, 2]);
        const i2 = aid(0, [0, 3]);
        const allocation = computeAllocation(
          policy,
          [i1, i2],
          credGrainViewUnbalanced,
          4
        );
        const participants = credGrainViewUnbalanced.participants();
        const expectedAmounts = G.splitBudget(policy.budget, [
          participants[0].credPerInterval[1],
          participants[1].credPerInterval[1],
        ]);
        const expectedReceipts = [
          {id: id3, amount: expectedAmounts[0]},
          {id: id4, amount: expectedAmounts[1]},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });

      it("handles 0 budget correctly", () => {
        const policy = immediate(0);
        const i1 = aid(3, [1, 1]);
        const i2 = aid(0, [3, 0]);
        const allocation = computeAllocation(
          policy,
          [i1, i2],
          credGrainViewUnbalanced,
          4
        );
        const expectedReceipts = [
          {id: id3, amount: nng(0)},
          {id: id4, amount: nng(0)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });
    });

    describe("recent policy", () => {
      beforeEach(async (done) => {
        credGraph = await GraphUtil.credGraph();
        credGrainView = CredGrainView.fromCredGraphAndLedger(
          credGraph,
          emptyLedger
        );
        done();
      });

      it("splits based on discounted cred", () => {
        const policy = recent(100, 0.1);
        const i1 = aid(0, [0, 0, 100]);
        const i2 = aid(100, [100, 0, 0]);
        const i3 = aid(0, [100, 0, 0]);
        const allocation = computeAllocation(
          policy,
          [i1, i2, i3],
          credGrainView,
          0
        );
        const expectedReceipts = [
          {id: i1.id, amount: nng(38)},
          {id: i2.id, amount: nng(31)},
          {id: i3.id, amount: nng(31)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });

      it("is not influenced by grain paid", () => {
        const policy = recent(100, 0.1);
        const i1 = aid(0, [100, 100, 100]);
        const i2 = aid(100, [100, 100, 100]);
        const allocation = computeAllocation(
          policy,
          [i1, i2],
          credGrainView,
          0
        );
        const expectedReceipts = [
          {id: i1.id, amount: nng(50)},
          {id: i2.id, amount: nng(50)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });

      it("handles full discount correctly", () => {
        const policy = recent(100, 1);
        const i1 = aid(50, [0, 50, 0]);
        const i2 = aid(0, [0, 10, 100]);
        const allocation = computeAllocation(
          policy,
          [i1, i2],
          credGrainView,
          0
        );
        const expectedReceipts = [
          {id: i1.id, amount: nng(0)},
          {id: i2.id, amount: nng(100)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });

      it("handles 0 budget correctly", () => {
        const policy = recent(0, 0.1);
        const i1 = aid(50, [100, 50, 10]);
        const i2 = aid(0, [0, 10, 100]);
        const allocation = computeAllocation(
          policy,
          [i1, i2],
          credGrainView,
          0
        );
        const expectedReceipts = [
          {id: i1.id, amount: nng(0)},
          {id: i2.id, amount: nng(0)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });
    });

    describe("balanced policy", () => {
      const {ledgerWithActiveIdentities} = createTestLedgerFixture();
      const unbalancedLedger = ledgerWithActiveIdentities(id3, id4);

      const allocationId1 = uuid.random();

      //Make an intentionally unbalanced distribution
      const allocation1 = {
        policy: {
          policyType: "IMMEDIATE",
          budget: nngFromString("110"),
          numIntervalsLookback: 1,
        },
        id: allocationId1,
        receipts: [
          {amount: g("100"), id: id3},
          {amount: g("10"), id: id4},
        ],
      };

      const distribution1 = {
        credTimestamp: 3,
        allocations: [allocation1],
        id: uuid.random(),
      };

      unbalancedLedger.distributeGrain(distribution1);
      const emptyLedger2 = ledgerWithActiveIdentities(id3, id4);

      let credGrainViewEmpty;
      let credGrainViewUnbalanced;
      beforeEach(async (done) => {
        credGraph = await GraphUtil.credGraph2();
        credGrainViewEmpty = CredGrainView.fromCredGraphAndLedger(
          credGraph,
          emptyLedger2
        );

        credGrainViewUnbalanced = CredGrainView.fromCredGraphAndLedger(
          credGraph,
          unbalancedLedger
        );

        done();
      });

      it("splits based on past Cred when there's no paid amounts", () => {
        const policy = balanced(100);

        const aid1 = aid(
          0,
          GraphUtil.expectedParticipant3.credPerInterval,
          id3
        );
        const aid2 = aid(
          0,
          GraphUtil.expectedParticipant4.credPerInterval,
          id4
        );
        const allocation = computeAllocation(
          policy,
          [aid1, aid2],
          credGrainViewEmpty,
          4
        );
        const expectedReceipts = [
          {id: aid1.id, amount: nng(28)},
          {id: aid2.id, amount: nng(72)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });

      it("takes past payment into account", () => {
        const policy = balanced(3000);
        const aid1 = aid(
          0,
          GraphUtil.expectedParticipant3.credPerInterval,
          id3
        );
        const aid2 = aid(
          0,
          GraphUtil.expectedParticipant4.credPerInterval,
          id4
        );
        const allocation = computeAllocation(
          policy,
          [aid1, aid2],
          credGrainViewUnbalanced,
          4
        );
        const expectedReceipts = [
          {id: aid1.id, amount: nng(802)},
          {id: aid2.id, amount: nng(2198)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });

      it("honors the lookback period", () => {
        const policy = balanced(2000, 1);
        const aid1 = aid(
          0,
          GraphUtil.expectedParticipant3.credPerInterval,
          id3
        );
        const aid2 = aid(
          0,
          GraphUtil.expectedParticipant4.credPerInterval,
          id4
        );
        const allocation = computeAllocation(
          policy,
          [aid1, aid2],
          credGrainViewUnbalanced,
          4
        );
        const expectedReceipts = [
          {id: aid1.id, amount: nng(34)},
          {id: aid2.id, amount: nng(1966)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });

      it("handles 0 budget correctly", () => {
        const policy = balanced(0);
        const aid1 = aid(
          0,
          GraphUtil.expectedParticipant3.credPerInterval,
          id3
        );
        const aid2 = aid(
          0,
          GraphUtil.expectedParticipant4.credPerInterval,
          id4
        );
        const allocation = computeAllocation(
          policy,
          [aid1, aid2],
          credGrainViewUnbalanced,
          4
        );
        const expectedReceipts = [
          {id: aid1.id, amount: nng(0)},
          {id: aid2.id, amount: nng(0)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });
    });

    describe("special policy", () => {
      beforeEach(async (done) => {
        credGraph = await GraphUtil.credGraph();
        credGrainView = CredGrainView.fromCredGraphAndLedger(
          credGraph,
          emptyLedger
        );
        done();
      });

      it("computeAllocation distributes the budget to the stated recipient", async () => {
        const i1 = aid(0, [1]);
        const credGraph2 = await GraphUtil.credGraph2();
        const ledger = ledgerWithActiveIdentities(id3, id4);
        const credGrainView = CredGrainView.fromCredGraphAndLedger(
          credGraph2,
          ledger
        );
        const policy = {
          policyType: "SPECIAL",
          budget: nng(100),
          memo: "something",
          recipient: id3,
        };
        const allocation = computeAllocation(policy, [i1], credGrainView, 0);
        const expectedReceipts = [{id: id3, amount: nng(100)}];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });
      it("errors if the recipient is not available", () => {
        const {id} = aid(0, [1]);
        const other = aid(0, [1]);
        const policy = {
          policyType: "SPECIAL",
          budget: nng(100),
          memo: "something",
          recipient: id,
        };
        const thunk = () =>
          computeAllocation(policy, [other], credGrainView, 0);
        expect(thunk).toThrowError("no active grain account for identity");
      });

      //Test ComputeAllocationSpecial function

      it("computeAllocationSpecial distributes the budget to the stated recipient", async () => {
        const credGraph2 = await GraphUtil.credGraph2();
        const ledger = ledgerWithActiveIdentities(id3, id4);
        const credGrainView = CredGrainView.fromCredGraphAndLedger(
          credGraph2,
          ledger
        );
        const policy = {
          policyType: "SPECIAL",
          budget: nng(100),
          memo: "something",
          recipient: id3,
        };
        const allocation = computeAllocationSpecial(policy, credGrainView);
        const expectedReceipts = [{id: id3, amount: nng(100)}];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });
      it("errors if the recipient is not available", async () => {
        const credGraph = await GraphUtil.credGraph2();
        const ledger = ledgerWithActiveIdentities(id3, id4);
        const credGrainView = CredGrainView.fromCredGraphAndLedger(
          credGraph,
          ledger
        );
        const policy = {
          policyType: "SPECIAL",
          budget: nng(100),
          memo: "something",
          recipient: uuid.random(),
        };
        const thunk = () => computeAllocationSpecial(policy, credGrainView);
        expect(thunk).toThrowError("no active grain account for identity");
      });
    });
  });
});
