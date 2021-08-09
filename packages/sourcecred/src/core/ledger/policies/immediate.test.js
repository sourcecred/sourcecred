// @flow

import * as G from "../grain";
import {fromGrain} from "../nonnegativeGrain";
import {immediateReceipts} from "./immediate";
import * as GraphUtil from "../../credrank/testUtils";
import {CredGrainView} from "../../credGrainView";
import {createTestLedgerFixture} from "../../ledger/testUtils";

describe("core/ledger/policies/immediate", () => {
  describe("immediateReceipts", () => {
    const {ledgerWithActiveIdentities} = createTestLedgerFixture();

    let credGraph;
    let credGrainView;
    let credGraph2;
    let credGrainViewUnbalanced;

    const id1 = GraphUtil.participant1.id;
    const id2 = GraphUtil.participant2.id;
    const id3 = GraphUtil.participant3.id;
    const id4 = GraphUtil.participant4.id;
    const unbalancedLedger = ledgerWithActiveIdentities(id3, id4);
    const emptyLedger = ledgerWithActiveIdentities(id1, id2);

    beforeEach(async (done) => {
      credGraph = await GraphUtil.credGraph();
      credGrainView = CredGrainView.fromCredGraphAndLedger(
        credGraph,
        emptyLedger
      );

      credGraph2 = await GraphUtil.credGraph2();
      credGrainViewUnbalanced = CredGrainView.fromCredGraphAndLedger(
        credGraph2,
        unbalancedLedger
      );

      done();
    });

    it("errors on invalid range", () => {
      const policy = {
        policyType: "IMMEDIATE",
        budget: fromGrain(G.ONE),
        numIntervalsLookback: -1,
      };
      expect(() => immediateReceipts(policy, credGrainView, 0)).toThrowError(
        `numIntervalsLookback must be at least 1`
      );
    });

    it("errors on float instead of int", () => {
      const policy = {
        policyType: "IMMEDIATE",
        budget: fromGrain(G.ONE),
        numIntervalsLookback: 1.5,
      };
      expect(() => immediateReceipts(policy, credGrainView, 0)).toThrowError(
        `numIntervalsLookback must be an integer`
      );
    });

    it("defaults lookback period > history to max history", () => {
      const policy1 = {
        policyType: "IMMEDIATE",
        budget: fromGrain(G.ONE),
        numIntervalsLookback: 2,
      };
      const policy2 = {
        policyType: "IMMEDIATE",
        budget: fromGrain(G.ONE),
        numIntervalsLookback: 50, // 50 > number of intervals (4)
      };
      const expected = immediateReceipts(policy1, credGrainViewUnbalanced, 4);
      const actual = immediateReceipts(policy2, credGrainViewUnbalanced, 4);
      expect(actual).toEqual(expected);
    });

    it("correctly computes GrainReceipt's when numIntervalsLookback equivalent to number of cred intervals", () => {
      const participants = credGrainViewUnbalanced.participants();
      const expectedAmounts = G.splitBudget(G.ONE, [
        participants[0].cred,
        participants[1].cred,
      ]);
      const expected = [
        {
          id: id3,
          amount: expectedAmounts[0],
        },
        {
          id: id4,
          amount: expectedAmounts[1],
        },
      ];
      const policy = {
        policyType: "IMMEDIATE",
        budget: fromGrain(G.ONE),
        numIntervalsLookback: 2,
      };
      expect(immediateReceipts(policy, credGrainViewUnbalanced, 4)).toEqual(
        expected
      );
    });

    it("correctly computes GrainReceipt's with numIntervalsLookback of 1", () => {
      const participants = credGrainViewUnbalanced.participants();
      const expectedAmounts = G.splitBudget(G.ONE, [
        participants[0].credPerInterval[1],
        participants[1].credPerInterval[1],
      ]);
      const expected = [
        {
          id: id3,
          amount: expectedAmounts[0],
        },
        {
          id: id4,
          amount: expectedAmounts[1],
        },
      ];
      const policy = {
        policyType: "IMMEDIATE",
        budget: fromGrain(G.ONE),
        numIntervalsLookback: 1,
      };
      expect(immediateReceipts(policy, credGrainViewUnbalanced, 4)).toEqual(
        expected
      );
    });
  });
});
