// @flow

import deepFreeze from "deep-freeze";
import {NodeAddress} from "../core/graph";
import {
  computeDistribution,
  computeAllocation,
  type CredHistory,
  type PolicyType,
} from "./grainAllocation";
import * as G from "./grain";

describe("src/ledger/grainAllocation", () => {
  const foo = NodeAddress.fromParts(["foo"]);
  const bar = NodeAddress.fromParts(["bar"]);

  const unevenInterval = deepFreeze({
    intervalEndMs: 10,
    cred: new Map([
      [foo, 9],
      [bar, 1],
    ]),
  });

  const evenInterval = deepFreeze({
    intervalEndMs: 20,
    cred: new Map([
      [foo, 1],
      [bar, 1],
    ]),
  });

  const singlePersonInterval = deepFreeze({
    intervalEndMs: 30,
    cred: new Map([[bar, 2]]),
  });

  const credHistory: CredHistory = deepFreeze([
    unevenInterval,
    evenInterval,
    singlePersonInterval,
  ]);

  describe.each([["IMMEDIATE"], ["BALANCED"]])(
    "Common Tests for %o",
    (policyType: PolicyType) => {
      const policy = deepFreeze({policyType, budget: G.ONE});

      it("it should return an empty allocation when the budget is zero", () => {
        const zeroPolicy = {budget: G.ZERO, policyType};
        const actual = computeAllocation(zeroPolicy, credHistory, new Map());

        expect(actual).toEqual({
          policy: zeroPolicy,
          receipts: [],
        });
      });
      it("should error when the Cred sums to 0", () => {
        const fail = () =>
          computeAllocation(
            policy,
            [
              {
                intervalEndMs: 500,
                cred: new Map([
                  [foo, 0],
                  [bar, 0],
                ]),
              },
            ],
            new Map()
          );

        expect(fail).toThrowError("cred sums to 0");
      });
      it("should error when there is no Cred", () => {
        const fail = () => computeAllocation(policy, [], new Map());
        expect(fail).toThrowError("credHistory is empty");
      });
      it("should error when the budget is negative", () => {
        const badPolicy = {...policy, budget: G.fromString("-100")};
        const fail = () => computeAllocation(badPolicy, [], new Map());
        expect(fail).toThrowError("invalid budget");
      });
    }
  );

  describe("immediateAllocation", () => {
    const policy = deepFreeze({policyType: "IMMEDIATE", budget: G.ONE});

    it("handles an interval with even cred distribution", () => {
      const result = computeAllocation(policy, [evenInterval], new Map());
      const HALF = G.fromApproximateFloat(0.5);
      const expectedReceipts = [
        {address: foo, amount: HALF},
        {address: bar, amount: HALF},
      ];
      expect(result).toEqual({policy, receipts: expectedReceipts});
    });
    it("handles an interval with un-even cred distribution", () => {
      const result = computeAllocation(policy, [unevenInterval], new Map());
      const ONE_TENTH = G.fromApproximateFloat(0.1);
      const NINE_TENTHS = G.fromApproximateFloat(0.9);
      const expectedReceipts = [
        {address: foo, amount: NINE_TENTHS},
        {address: bar, amount: ONE_TENTH},
      ];
      expect(result).toEqual({policy, receipts: expectedReceipts});
    });
    it("handles an interval with one cred recipient", () => {
      const result = computeAllocation(
        policy,
        [singlePersonInterval],
        new Map()
      );
      const expectedReceipts = [{address: bar, amount: G.ONE}];
      expect(result).toEqual({policy, receipts: expectedReceipts});
    });
  });

  describe("balancedAllocation", () => {
    const policy = {policyType: "BALANCED", budget: G.fromApproximateFloat(14)};

    it("should only pay Foo if Foo is sufficiently underpaid", () => {
      const alreadyPaid = new Map([
        [foo, G.ZERO],
        [bar, G.fromApproximateFloat(99)],
      ]);
      const expectedReceipts = [
        {address: foo, amount: G.fromApproximateFloat(14)},
      ];
      const actual = computeAllocation(policy, credHistory, alreadyPaid);
      expect(actual).toEqual({policy, receipts: expectedReceipts});
    });
    it("should divide according to cred if everyone is already balanced paid", () => {
      const alreadyPaid = new Map([
        [foo, G.fromApproximateFloat(5)],
        [bar, G.fromApproximateFloat(2)],
      ]);

      // Total cred is foo: 10, bar: 4, past allocations are exactly half this
      // Since we are distributing 14g, we expect it to be proportional to
      // their cred scores since past allocations are already "balanced"
      const expectedReceipts = [
        {address: foo, amount: G.fromApproximateFloat(10)},
        {address: bar, amount: G.fromApproximateFloat(4)},
      ];

      const actual = computeAllocation(policy, credHistory, alreadyPaid);
      expect(actual).toEqual({policy, receipts: expectedReceipts});
    });
    it("'top off' users who were slightly underpaid", () => {
      // Foo is exactly 1 grain behind where they "should" be
      const alreadyPaid = new Map([
        [foo, G.fromApproximateFloat(4)],
        [bar, G.fromApproximateFloat(2)],
      ]);

      const policy15 = {
        policyType: "BALANCED",
        budget: G.fromApproximateFloat(15),
      };

      const expectedReceipts = [
        {address: foo, amount: G.fromApproximateFloat(11)},
        {address: bar, amount: G.fromApproximateFloat(4)},
      ];

      const actual = computeAllocation(policy15, credHistory, alreadyPaid);
      expect(actual).toEqual({
        policy: policy15,
        receipts: expectedReceipts,
      });
    });

    it("should handle the case where one user has no historical earnings", () => {
      const alreadyPaid = new Map([[foo, G.fromApproximateFloat(5)]]);

      const expectedReceipts = [
        {address: bar, amount: G.fromApproximateFloat(2)},
      ];
      const policy2 = {
        policyType: "BALANCED",
        budget: G.fromApproximateFloat(2),
      };

      const actual = computeAllocation(policy2, credHistory, alreadyPaid);
      expect(actual).toEqual({policy: policy2, receipts: expectedReceipts});
    });
    it("should not break if a user has earnings but no cred", () => {
      const alreadyPaid = new Map([
        [NodeAddress.fromParts(["zoink"]), G.fromApproximateFloat(10)],
      ]);

      const expectedReceipts = [
        {address: foo, amount: G.fromApproximateFloat(10)},
        {address: bar, amount: G.fromApproximateFloat(4)},
      ];

      const actual = computeAllocation(policy, credHistory, alreadyPaid);
      expect(actual).toEqual({receipts: expectedReceipts, policy});
    });
  });

  describe("computeDistribution", () => {
    it("handles the case with no policies", () => {
      const distribution = computeDistribution([], credHistory, new Map());
      expect(distribution).toEqual({credTimestamp: 30, allocations: []});
    });
    it("includes the credTimestamp from the latest cred slice", () => {
      const tsForHistory = (history) =>
        computeDistribution([], history, new Map()).credTimestamp;
      expect(tsForHistory(credHistory)).toEqual(30);
      expect(tsForHistory(credHistory.slice(0, 2))).toEqual(20);
      expect(tsForHistory(credHistory.slice(0, 1))).toEqual(10);
    });
    it("throws an error on an empty history", () => {
      expect(() => computeDistribution([], [], new Map())).toThrowError(
        "empty credHistory"
      );
    });
    it("throws an error on a history with an invalid timestamp", () => {
      const bad = [NaN, Infinity, -Infinity];
      for (const b of bad) {
        const badHistory = [{intervalEndMs: b, cred: new Map()}];
        expect(() =>
          computeDistribution([], badHistory, new Map())
        ).toThrowError("invalid credTimestamp");
      }
    });
  });
});
