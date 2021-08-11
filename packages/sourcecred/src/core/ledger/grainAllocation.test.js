// @flow

import {random as randomUuid, parser as uuidParser} from "../../util/uuid";
import {
  computeAllocation,
  computeAllocationSpecial,
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
    let credGraph2;
    let credGrainView2;
    const id1 = GraphUtil.participant1.id;
    const id2 = GraphUtil.participant2.id;
    const id3 = GraphUtil.participant3.id;
    const id4 = GraphUtil.participant4.id;

    const emptyLedger = ledgerWithActiveIdentities(id1, id2);
    const emptyLedger2 = ledgerWithActiveIdentities(id3, id4);

    describe("validation", () => {
      beforeEach(async (done) => {
        credGraph = await GraphUtil.credGraph();
        credGraph2 = await GraphUtil.credGraph2();

        credGrainView = CredGrainView.fromCredGraphAndLedger(
          credGraph,
          emptyLedger
        );

        credGrainView2 = CredGrainView.fromCredGraphAndLedger(
          credGraph2,
          emptyLedger2
        );
        done();
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
        const allocation = computeAllocation(
          policy,
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
        const allocation = computeAllocation(
          policy,
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

      let credGraph2;
      let credGrainViewUnbalanced;
      let credGrainViewUnbalancedUnpaid;
      beforeEach(async (done) => {
        credGraph2 = await GraphUtil.credGraph2();
        const unbalancedLedger = ledgerWithActiveIdentities(id3, id4);
        credGrainViewUnbalanced = CredGrainView.fromCredGraphAndLedger(
          credGraph2,
          unbalancedLedger
        );
        credGrainViewUnbalancedUnpaid = CredGrainView.fromCredGraphAndLedger(
          credGraph2,
          ledgerWithActiveIdentities(id3, id4)
        );
        done();
      });

      it("splits based on discounted cred", () => {
        const policy = recent(100, 0.1);
        const allocation = computeAllocation(
          policy,
          credGrainViewUnbalancedUnpaid,
          4
        );
        const expectedReceipts = [
          {id: id3, amount: nng(27)},
          {id: id4, amount: nng(73)},
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
        const allocation = computeAllocation(
          policy,
          credGrainViewUnbalanced,
          4
        );
        const expectedReceipts = [
          {id: id3, amount: nng(27)},
          {id: id4, amount: nng(73)},
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
        const allocation = computeAllocation(
          policy,
          credGrainViewUnbalanced,
          4
        );
        const expectedReceipts = [
          {id: id3, amount: nng(6)},
          {id: id4, amount: nng(94)},
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
        const allocation = computeAllocation(
          policy,
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
      let credGrainViewEmpty;
      let credGrainViewUnbalanced;

      beforeEach(async (done) => {
        credGraph = await GraphUtil.credGraph2();
        credGrainViewEmpty = CredGrainView.fromCredGraphAndLedger(
          credGraph,
          ledgerWithActiveIdentities(id3, id4)
        );

        credGrainViewUnbalanced = CredGrainView.fromCredGraphAndLedger(
          credGraph,
          unbalancedLedger
        );

        done();
      });

      it("splits based on past Cred when there's no paid amounts", () => {
        const policy = balanced(100);
        const allocation = computeAllocation(policy, credGrainViewEmpty, 4);
        const expectedReceipts = [
          {id: id3, amount: nng(28)},
          {id: id4, amount: nng(72)},
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

        const allocation = computeAllocation(
          policy,
          credGrainViewUnbalanced,
          4
        );
        const expectedReceipts = [
          {id: id3, amount: nng(802)},
          {id: id4, amount: nng(2198)},
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
        const allocation = computeAllocation(
          policy,
          credGrainViewUnbalanced,
          4
        );
        const expectedReceipts = [
          {id: id3, amount: nng(34)},
          {id: id4, amount: nng(1966)},
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
        const allocation = computeAllocation(
          policy,
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

    describe("special policy", () => {
      beforeEach(async (done) => {
        credGraph = await GraphUtil.credGraph();
        credGraph2 = await GraphUtil.credGraph2();

        credGrainView = CredGrainView.fromCredGraphAndLedger(
          credGraph,
          emptyLedger
        );

        credGrainView2 = CredGrainView.fromCredGraphAndLedger(
          credGraph2,
          emptyLedger2
        );
        done();
      });

      it("distributes the budget to the stated recipient", () => {
        const policy = {
          policyType: "SPECIAL",
          budget: nng(100),
          memo: "something",
          recipient: id2,
        };
        const allocation = computeAllocation(policy, credGrainView, 0);
        const expectedReceipts = [{id: id2, amount: nng(100)}];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });
      it("errors if the recipient is not available", () => {
        const policy = {
          policyType: "SPECIAL",
          budget: nng(100),
          memo: "something",
          recipient: id3,
        };
        const thunk = () => computeAllocation(policy, credGrainView, 0);
        expect(thunk).toThrowError("no active grain account for identity");
      });

      //Test ComputeAllocationSpecial function

      it("distributes the budget to the stated recipient", () => {
        const policy = {
          policyType: "SPECIAL",
          budget: nng(100),
          memo: "something",
          recipient: id1,
        };
        const identities = credGrainView
          .activeParticipants()
          .map((participant) => participant.identity);

        const allocation = computeAllocationSpecial(policy, identities);
        const expectedReceipts = [{id: id1, amount: nng(100)}];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });
      it("errors if the recipient is not available", () => {
        const policy = {
          policyType: "SPECIAL",
          budget: nng(100),
          memo: "something",
          recipient: id2,
        };

        const identities = credGrainView2
          .activeParticipants()
          .map((participant) => participant.identity);

        const thunk = () => computeAllocationSpecial(policy, identities);
        expect(thunk).toThrowError("no active grain account for identity");
      });
    });
  });
});
