// @flow

import {NodeAddress} from "../core/graph";
import {ONE, ZERO, fromApproximateFloat} from "./grain";
import {
  GRAIN_ALLOCATION_VERSION_1,
  createGrainAllocation,
} from "./createGrainAllocation";
import deepFreeze from "deep-freeze";
import type {
  CredHistory,
  BalancedV1,
  ImmediateV1,
  GrainReceipt,
  GrainAllocationV1,
  AllocationStrategy,
} from "./createGrainAllocation";
import * as G from "./grain";

describe("src/grain/createGrainAllocation", () => {
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

  const immediateStrategy: ImmediateV1 = deepFreeze({
    type: "IMMEDIATE",
    version: 1,
  });

  const balancedStrategy: BalancedV1 = deepFreeze({
    type: "BALANCED",
    version: 1,
  });

  describe.each([[immediateStrategy], [balancedStrategy]])(
    "Common Tests for %o",
    (strategy: AllocationStrategy) => {
      const BUDGET = ONE;

      it("throws an error if given an unsupported strategy", () => {
        const unsupportedStrategy = {
          ...strategy,
          version: 2,
        };
        expect(() =>
          createGrainAllocation(
            unsupportedStrategy,
            BUDGET,
            credHistory,
            new Map()
          )
        ).toThrowError(`Unsupported ${strategy.type} version: 2`);
      });

      it("throws an error if given an unsupported strategy and an empty credHistory", () => {
        const unsupportedStrategy = {
          ...strategy,
          version: 2,
        };
        expect(() =>
          createGrainAllocation(unsupportedStrategy, BUDGET, [], new Map())
        ).toThrowError(`Unsupported ${strategy.type} version: 2`);
      });

      describe("it should return an empty allocation when", () => {
        const emptyAllocation = deepFreeze({
          version: GRAIN_ALLOCATION_VERSION_1,
          strategy,
          budget: BUDGET,
          receipts: [],
        });

        it("the budget is zero", () => {
          const actual = createGrainAllocation(
            strategy,
            ZERO,
            credHistory,
            new Map()
          );

          expect(actual).toEqual({
            ...emptyAllocation,
            budget: ZERO,
          });
        });

        it("there are no cred scores at all", () => {
          const actual = createGrainAllocation(strategy, BUDGET, [], new Map());
          expect(actual).toEqual(emptyAllocation);
        });

        it("all the cred sums to 0", () => {
          const actual = createGrainAllocation(
            strategy,
            BUDGET,
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

          expect(actual).toEqual(emptyAllocation);
        });
      });
    }
  );

  describe("immediateAllocation", () => {
    const BUDGET = ONE;

    const createImmediateAllocation = (
      receipts: $ReadOnlyArray<GrainReceipt>
    ): GrainAllocationV1 => {
      return {
        version: GRAIN_ALLOCATION_VERSION_1,
        strategy: immediateStrategy,
        budget: BUDGET,
        receipts,
      };
    };

    it("handles an interval with even cred distribution", () => {
      const result = createGrainAllocation(
        immediateStrategy,
        BUDGET,
        [evenInterval],
        new Map()
      );
      const HALF = G.fromApproximateFloat(0.5);
      const expectedReceipts = [
        {address: foo, amount: HALF},
        {address: bar, amount: HALF},
      ];
      const expectedAllocation = createImmediateAllocation(expectedReceipts);
      expect(result).toEqual(expectedAllocation);
    });
    it("handles an interval with un-even cred distribution", () => {
      const result = createGrainAllocation(
        immediateStrategy,
        BUDGET,
        [unevenInterval],
        new Map()
      );
      const ONE_TENTH = G.fromApproximateFloat(0.1);
      const NINE_TENTHS = G.fromApproximateFloat(0.9);
      const expectedReceipts = [
        {address: foo, amount: NINE_TENTHS},
        {address: bar, amount: ONE_TENTH},
      ];
      const expectedAllocation = createImmediateAllocation(expectedReceipts);
      expect(result).toEqual(expectedAllocation);
    });
    it("handles an interval with one cred recipient", () => {
      const result = createGrainAllocation(
        immediateStrategy,
        BUDGET,
        [singlePersonInterval],
        new Map()
      );
      const expectedReceipts = [{address: bar, amount: BUDGET}];
      const expectedAllocation = createImmediateAllocation(expectedReceipts);
      expect(result).toEqual(expectedAllocation);
    });
  });

  describe("balancedAllocation", () => {
    const BUDGET = fromApproximateFloat(14);

    const createBalancedAllocation = (
      receipts: $ReadOnlyArray<GrainReceipt>,
      budget: G.Grain
    ) => {
      return {
        version: GRAIN_ALLOCATION_VERSION_1,
        strategy: balancedStrategy,
        budget,
        receipts,
      };
    };

    it("should only pay Foo if Foo is sufficiently underpaid", () => {
      const lifetimeAllocations = new Map([
        [foo, ZERO],
        [bar, fromApproximateFloat(99)],
      ]);
      const expectedReceipts = [
        {address: foo, amount: fromApproximateFloat(14)},
      ];
      const expectedAllocation = createBalancedAllocation(
        expectedReceipts,
        BUDGET
      );
      const actual = createGrainAllocation(
        balancedStrategy,
        BUDGET,
        credHistory,
        lifetimeAllocations
      );
      expect(expectedAllocation).toEqual(actual);
    });
    it("should divide according to cred if everyone is already balanced paid", () => {
      const lifetimeAllocations = new Map([
        [foo, fromApproximateFloat(5)],
        [bar, fromApproximateFloat(2)],
      ]);

      // Total cred is foo: 10, bar: 4, past allocations are exactly half this
      // Since we are distributing 14g, we expect it to be proportional to
      // their cred scores since past allocations are already "balanced"
      const expectedReceipts = [
        {address: foo, amount: fromApproximateFloat(10)},
        {address: bar, amount: fromApproximateFloat(4)},
      ];

      const expectedAllocation = createBalancedAllocation(
        expectedReceipts,
        BUDGET
      );

      const actual = createGrainAllocation(
        balancedStrategy,
        BUDGET,
        credHistory,
        lifetimeAllocations
      );
      expect(expectedAllocation).toEqual(actual);
    });
    it("'top off' users who were slightly underpaid", () => {
      // Foo is exactly 1 grain behind where they "should" be
      const lifetimeAllocations = new Map([
        [foo, fromApproximateFloat(4)],
        [bar, fromApproximateFloat(2)],
      ]);

      const BUDGET15 = fromApproximateFloat(15);

      const expectedReceipts = [
        {address: foo, amount: fromApproximateFloat(11)},
        {address: bar, amount: fromApproximateFloat(4)},
      ];

      const expectedAllocation = createBalancedAllocation(
        expectedReceipts,
        BUDGET15
      );

      const actual = createGrainAllocation(
        balancedStrategy,
        BUDGET15,
        credHistory,
        lifetimeAllocations
      );
      expect(expectedAllocation).toEqual(actual);
    });

    it("should handle the case where one user has no historical earnings", () => {
      const lifetimeAllocations = new Map([[foo, fromApproximateFloat(5)]]);

      const expectedReceipts = [
        {address: bar, amount: fromApproximateFloat(2)},
      ];
      const BUDGET2 = fromApproximateFloat(2);

      const expectedAllocation = createBalancedAllocation(
        expectedReceipts,
        BUDGET2
      );

      const actual = createGrainAllocation(
        balancedStrategy,
        BUDGET2,
        credHistory,
        lifetimeAllocations
      );
      expect(expectedAllocation).toEqual(actual);
    });
    it("should not break if a user has earnings but no cred", () => {
      const lifetimeAllocations = new Map([
        [NodeAddress.fromParts(["zoink"]), fromApproximateFloat(10)],
      ]);

      const expectedReceipts = [
        {address: foo, amount: fromApproximateFloat(10)},
        {address: bar, amount: fromApproximateFloat(4)},
      ];

      const expectedAllocation = createBalancedAllocation(
        expectedReceipts,
        BUDGET
      );

      const actual = createGrainAllocation(
        balancedStrategy,
        BUDGET,
        credHistory,
        lifetimeAllocations
      );
      expect(expectedAllocation).toEqual(actual);
    });
  });
});
