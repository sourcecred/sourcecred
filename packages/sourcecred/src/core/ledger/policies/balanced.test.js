// @flow

import {processIdentities} from "../processedIdentities";
import {random as randomUuid} from "../../../util/uuid";
import {balancedReceipts} from "./balanced";
import * as GraphUtil from "../../credrank/testUtils";
import {createTestLedgerFixture} from "../../ledger/testUtils";
import {CredGrainView} from "../../credGrainView";
import {type AllocationIdentity} from "../grainAllocation";
import {fromString as nngFromString} from "../nonnegativeGrain";
const nng = (x: number) => nngFromString(x.toString());
import {g} from "../../ledger/testUtils";
import * as uuid from "../../../util/uuid";

function aid(
  paid: number,
  cred: $ReadOnlyArray<number>,
  id = randomUuid()
): AllocationIdentity {
  return {id: id, paid: nng(paid), cred};
}

describe("core/ledger/policies/balanced", () => {
  const id1 = GraphUtil.participant1.id;
  const id2 = GraphUtil.participant2.id;
  const id3 = GraphUtil.participant3.id;
  const id4 = GraphUtil.participant4.id;

  const {ledgerWithActiveIdentities} = createTestLedgerFixture();
  const emptyLedger = ledgerWithActiveIdentities(id1, id2);
  const unbalancedLedger = ledgerWithActiveIdentities(id3, id4);
  const allocationId1 = uuid.random();

  const allocation1 = {
    policy: {
      policyType: "IMMEDIATE",
      budget: nngFromString("100"),
      numIntervalsLookback: 1,
    },
    id: allocationId1,
    receipts: [
      {amount: g("100"), id: id3},
      {amount: g("10"), id: id3},
    ],
  };

  const distribution1 = {
    credTimestamp: 3,
    allocations: [allocation1],
    id: uuid.random(),
  };

  unbalancedLedger.distributeGrain(distribution1);

  let credGraph;
  let credGraph2;
  let credGrainView;
  let credGrainViewUnbalanced;

  beforeEach(async (done) => {
    credGraph = await GraphUtil.credGraph();
    credGraph2 = await GraphUtil.credGraph2();

    credGrainView = CredGrainView.fromCredGraphAndLedger(
      credGraph,
      emptyLedger
    );

    credGrainViewUnbalanced = CredGrainView.fromCredGraphAndLedger(
      credGraph2,
      unbalancedLedger
    );
    done();
  });

  describe("balancedReceipts", () => {
    const aid1 = aid(0, GraphUtil.expectedParticipant3.credPerInterval, id1);
    const aid2 = aid(0, GraphUtil.expectedParticipant4.credPerInterval, id2);

    const aid3 = aid(0, GraphUtil.expectedParticipant3.credPerInterval, id3);
    const aid4 = aid(0, GraphUtil.expectedParticipant4.credPerInterval, id4);

    const processedIdentities = processIdentities([aid1, aid2]);
    const processedIdentities2 = processIdentities([aid3, aid4]);

    it("errors on invalid range", () => {
      const policy = {
        policyType: "BALANCED",
        budget: nng(100),
        numIntervalsLookback: -1,
      };
      expect(() =>
        balancedReceipts(policy, processedIdentities, credGrainView)
      ).toThrowError(`numIntervalsLookback must be at least 0`);
    });

    it("errors on float instead of int", () => {
      const policy = {
        policyType: "BALANCED",
        budget: nng(100),
        numIntervalsLookback: 1.5,
      };
      expect(() =>
        balancedReceipts(policy, processedIdentities, credGrainView)
      ).toThrowError(`numIntervalsLookback must be an integer`);
    });

    it("defaults lookback period > history to max history", () => {
      const policy1 = {
        policyType: "BALANCED",
        budget: nng(100),
        numIntervalsLookback: 0, // 0 means forever, but there are only 2 intervals in the test data
      };
      const policy2 = {
        policyType: "BALANCED",
        budget: nng(100),
        numIntervalsLookback: 50, // 50 > number of intervals (2)
      };
      const expected = balancedReceipts(
        policy1,
        processedIdentities2,
        credGrainViewUnbalanced
      );
      const actual = balancedReceipts(
        policy2,
        processedIdentities2,
        credGrainViewUnbalanced
      );
      expect(actual).toEqual(expected);
    });

    it("correctly computes GrainReceipt's when numIntervalsLookback equivalent to number of cred intervals", () => {
      const policy1 = {
        policyType: "BALANCED",
        budget: nng(100),
        numIntervalsLookback: 0, // 0 means forever, but there are only 2 intervals in the test data
      };
      const policy2 = {
        policyType: "BALANCED",
        budget: nng(100),
        numIntervalsLookback: 2,
      };
      const expected = balancedReceipts(
        policy1,
        processedIdentities2,
        credGrainViewUnbalanced
      );
      const actual = balancedReceipts(
        policy2,
        processedIdentities2,
        credGrainViewUnbalanced
      );
      expect(actual).toEqual(expected);
    });

    it("correctly computes GrainReceipt's with numIntervalsLookback of 1", () => {
      const policy1 = {
        policyType: "BALANCED",
        budget: nng(2000),
        numIntervalsLookback: 1, // 0 means forever, but there are only 2 intervals in the test data
      };
      const expectedReceipts = [
        {id: aid3.id, amount: nng(127)},
        {id: aid4.id, amount: nng(1873)},
      ];
      const actualReceipts = balancedReceipts(
        policy1,
        processedIdentities2,
        credGrainViewUnbalanced
      );
      expect(actualReceipts).toEqual(expectedReceipts);
    });
  });
});
