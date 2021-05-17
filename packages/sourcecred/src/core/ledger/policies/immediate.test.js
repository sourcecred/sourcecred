// @flow

import * as G from "../grain";
import {processIdentities} from "../processedIdentities";
import {random as randomUuid} from "../../../util/uuid";
import {fromGrain} from "../nonnegativeGrain";
import {immediateReceipts} from "./immediate";

describe("core/ledger/policies/immediate", () => {
  describe("immediateReceipts", () => {
    const id1 = randomUuid();
    const id2 = randomUuid();
    const identities = [
      {
        cred: [10, 20, 30, 40],
        id: id1,
        paid: G.ONE,
      },
      {
        cred: [200, 0, 0, 0],
        id: id2,
        paid: G.ZERO,
      },
    ];
    const processedIdentities = processIdentities(identities);

    it("errors on invalid range", () => {
      const policy = {
        policyType: "IMMEDIATE",
        budget: fromGrain(G.ONE),
        numIntervalsLookback: -1,
      };
      expect(() => immediateReceipts(policy, processedIdentities)).toThrowError(
        `numIntervalsLookback must be at least 1`
      );
    });

    it("errors on float instead of int", () => {
      const policy = {
        policyType: "IMMEDIATE",
        budget: fromGrain(G.ONE),
        numIntervalsLookback: 1.5,
      };
      expect(() => immediateReceipts(policy, processedIdentities)).toThrowError(
        `numIntervalsLookback must be an integer`
      );
    });

    it("defaults lookback period > history to max history", () => {
      const policy1 = {
        policyType: "IMMEDIATE",
        budget: fromGrain(G.ONE),
        numIntervalsLookback: 4,
      };
      const policy2 = {
        policyType: "IMMEDIATE",
        budget: fromGrain(G.ONE),
        numIntervalsLookback: 50, // 50 > number of intervals (4)
      };
      const expected = immediateReceipts(policy1, processedIdentities);
      const actual = immediateReceipts(policy2, processedIdentities);
      expect(actual).toEqual(expected);
    });

    it("correctly computes GrainReceipt's when numIntervalsLookback equivalent to number of cred intervals", () => {
      const expectedAmounts = G.splitBudget(G.ONE, [100, 200]);
      const expected = [
        {
          id: id1,
          amount: expectedAmounts[0],
        },
        {
          id: id2,
          amount: expectedAmounts[1],
        },
      ];
      const policy = {
        policyType: "IMMEDIATE",
        budget: fromGrain(G.ONE),
        numIntervalsLookback: 4,
      };
      expect(immediateReceipts(policy, processedIdentities)).toEqual(expected);
    });

    it("correctly computes GrainReceipt's with numIntervalsLookback of 1", () => {
      const identities = [
        {
          cred: [0, 40],
          id: id1,
          paid: G.ONE,
        },
        {
          cred: [100000, 60],
          id: id2,
          paid: G.ZERO,
        },
      ];
      const processedIdentities = processIdentities(identities);
      const expectedAmounts = G.splitBudget(G.ONE, [40, 60]);
      const expected = [
        {
          id: id1,
          amount: expectedAmounts[0],
        },
        {
          id: id2,
          amount: expectedAmounts[1],
        },
      ];
      const policy = {
        policyType: "IMMEDIATE",
        budget: fromGrain(G.ONE),
        numIntervalsLookback: 1,
      };
      expect(immediateReceipts(policy, processedIdentities)).toEqual(expected);
    });
  });
});
