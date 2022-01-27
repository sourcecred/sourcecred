// @flow

import {balancedReceipts} from "./balanced";
import * as GraphUtil from "../../credrank/testUtils";
import {createTestLedgerFixture} from "../../ledger/testUtils";
import {CredGrainView} from "../../credGrainView";
import {fromString as nngFromString} from "../nonnegativeGrain";
const nng = (x: number) => nngFromString(x.toString());
import {g} from "../../ledger/testUtils";
import * as uuid from "../../../util/uuid";

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
      {amount: g("10"), id: id4},
    ],
  };

  const distribution1 = {
    credTimestamp: GraphUtil.week2 + 1,
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
    it("errors on invalid range", () => {
      const policy = {
        policyType: "BALANCED",
        budget: nng(100),
        numIntervalsLookback: -1,
      };
      expect(() => balancedReceipts(policy, credGrainView, 0)).toThrowError(
        `numIntervalsLookback must be at least 0`
      );
    });

    it("errors on float instead of int", () => {
      const policy = {
        policyType: "BALANCED",
        budget: nng(100),
        numIntervalsLookback: 1.5,
      };
      expect(() => balancedReceipts(policy, credGrainView, 0)).toThrowError(
        `numIntervalsLookback must be an integer`
      );
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
        credGrainViewUnbalanced,
        GraphUtil.week3
      );
      const actual = balancedReceipts(
        policy2,
        credGrainViewUnbalanced,
        GraphUtil.week3
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
        credGrainViewUnbalanced,
        GraphUtil.week3
      );
      const actual = balancedReceipts(
        policy2,
        credGrainViewUnbalanced,
        GraphUtil.week3
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
        {id: id3, amount: nng(34)},
        {id: id4, amount: nng(1966)},
      ];
      const actualReceipts = balancedReceipts(
        policy1,
        credGrainViewUnbalanced,
        GraphUtil.week3 + 1
      );
      expect(actualReceipts).toEqual(expectedReceipts);
    });
  });
});
