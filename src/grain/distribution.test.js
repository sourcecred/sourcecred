// @flow

import {NodeAddress} from "../core/graph";
import {ONE, ZERO, fromApproximateFloat, format} from "./grain";
import {DISTRIBUTION_VERSION_1, distribution} from "./distribution";
import deepFreeze from "deep-freeze";
import type {
  CredHistory,
  LifetimeV1,
  ImmediateV1,
  GrainReceipt,
  DistributionStrategy,
  DistributionV1,
} from "./distribution";
import type {Grain} from "./grain";

describe("src/grain/distribution", () => {
  const foo = NodeAddress.fromParts(["foo"]);
  const bar = NodeAddress.fromParts(["bar"]);

  const timestampMs = 1000;

  const credHistory: CredHistory = deepFreeze([
    {
      intervalEndMs: 10,
      cred: new Map([
        [foo, 9],
        [bar, 1],
      ]),
    },
    {
      intervalEndMs: 20,
      cred: new Map([
        [foo, 1],
        [bar, 1],
      ]),
    },
    {intervalEndMs: 30, cred: new Map([[bar, 2]])},
  ]);

  // there's no JSON serialization for BigInts, so we need to convert
  // the BigInts before passing them into expect comparisons. Otherwise,
  // when the tests fail, they'll fail with an unhelpful JSON serialization
  // issue.
  function fmt(g: Grain) {
    return format(g, 3);
  }
  function safeReceipts(receipts: $ReadOnlyArray<GrainReceipt>) {
    return receipts.map(({address, amount}) => ({
      address,
      amount: fmt(amount),
    }));
  }
  function safeStrategy(strat: DistributionStrategy) {
    return {...strat, budget: fmt(strat.budget)};
  }
  function safeDistribution(distribution: DistributionV1) {
    return {
      ...distribution,
      strategy: safeStrategy(distribution.strategy),
      receipts: safeReceipts(distribution.receipts),
    };
  }
  function expectDistributionsEqual(h1, h2) {
    expect(safeDistribution(h1)).toEqual(safeDistribution(h2));
  }

  describe("immediateDistribution", () => {
    const strategy: ImmediateV1 = deepFreeze({
      type: "IMMEDIATE",
      budget: ONE,
      version: 1,
    });

    describe("it should return an empty distribution when", () => {
      const emptyDistribution = deepFreeze({
        type: "DISTRIBUTION",
        version: DISTRIBUTION_VERSION_1,
        receipts: [],
        strategy,
        timestampMs,
      });

      it("there are no cred scores at all", () => {
        const actual = distribution(strategy, [], new Map(), timestampMs);
        expectDistributionsEqual(actual, emptyDistribution);
      });

      it("all cred scores are from the future", () => {
        const actual = distribution(strategy, credHistory, new Map(), 0);
        expectDistributionsEqual(actual, {
          ...emptyDistribution,
          timestampMs: 0,
        });
      });

      it("all the cred sums to 0", () => {
        const actual = distribution(
          strategy,
          [
            {
              intervalEndMs: timestampMs - 500,
              cred: new Map([
                [foo, 0],
                [bar, 0],
              ]),
            },
          ],
          new Map(),
          timestampMs
        );

        expectDistributionsEqual(actual, emptyDistribution);
      });
    });

    const createImmediateDistribution = (
      timestampMs: number,
      receipts: $ReadOnlyArray<GrainReceipt>
    ) => {
      return {
        type: "DISTRIBUTION",
        version: DISTRIBUTION_VERSION_1,
        receipts,
        strategy,
        timestampMs,
      };
    };

    it("throws an error if given an unsupported strategy", () => {
      const unsupportedStrategy = {
        ...strategy,
        version: 2,
      };
      expect(() =>
        distribution(unsupportedStrategy, credHistory, new Map(), timestampMs)
      ).toThrowError(`Unsupported IMMEDIATE strategy: 2`);
    });
    it("handles an interval in the middle", () => {
      const result = distribution(strategy, credHistory, new Map(), 20);
      // $ExpectFlowError
      const HALF = ONE / 2n;
      const expectedReceipts = [
        {address: foo, amount: HALF},
        {address: bar, amount: HALF},
      ];
      const expectedDistribution = createImmediateDistribution(
        20,
        expectedReceipts
      );
      expectDistributionsEqual(result, expectedDistribution);
    });
    it("handles an interval with un-even cred distribution", () => {
      const result = distribution(strategy, credHistory, new Map(), 12);
      // $ExpectFlowError
      const ONE_TENTH = ONE / 10n;
      const NINE_TENTHS = ONE - ONE_TENTH;
      const expectedReceipts = [
        {address: foo, amount: NINE_TENTHS},
        {address: bar, amount: ONE_TENTH},
      ];
      const expectedDistribution = createImmediateDistribution(
        12,
        expectedReceipts
      );
      expectDistributionsEqual(result, expectedDistribution);
    });
    it("handles an interval at the end", () => {
      const result = distribution(strategy, credHistory, new Map(), 1000);
      const expectedReceipts = [{address: bar, amount: ONE}];
      const expectedDistribution = createImmediateDistribution(
        1000,
        expectedReceipts
      );
      expectDistributionsEqual(result, expectedDistribution);
    });
  });

  describe("lifetimeDistribution", () => {
    const strategy = deepFreeze({
      type: "LIFETIME",
      budget: fromApproximateFloat(14),
      version: 1,
    });

    const createLifetimeDistribution = (
      timestampMs: number,
      receipts: $ReadOnlyArray<GrainReceipt>,
      strategy: LifetimeV1
    ) => {
      return {
        type: "DISTRIBUTION",
        version: DISTRIBUTION_VERSION_1,
        receipts,
        strategy,
        timestampMs,
      };
    };

    describe("it should return an empty distribution when", () => {
      const emptyDistribution = deepFreeze({
        type: "DISTRIBUTION",
        version: DISTRIBUTION_VERSION_1,
        receipts: [],
        strategy,
        timestampMs,
      });

      it("there are no cred scores at all", () => {
        const actual = distribution(strategy, [], new Map(), timestampMs);

        expectDistributionsEqual(actual, emptyDistribution);
      });

      it("all cred scores are from the future", () => {
        const actual = distribution(strategy, credHistory, new Map(), 0);
        expectDistributionsEqual(actual, {
          ...emptyDistribution,
          timestampMs: 0,
        });
      });

      it("all the cred sums to 0", () => {
        const actual = distribution(
          strategy,
          [
            {
              intervalEndMs: timestampMs - 500,
              cred: new Map([
                [foo, 0],
                [bar, 0],
              ]),
            },
          ],
          new Map(),
          timestampMs
        );

        expectDistributionsEqual(actual, emptyDistribution);
      });
    });

    it("throws an error if given an unsupported strategy", () => {
      const unsupportedStrategy = {
        ...strategy,
        version: 2,
      };
      expect(() =>
        distribution(unsupportedStrategy, credHistory, new Map(), timestampMs)
      ).toThrowError(`Unsupported LIFETIME strategy: 2`);
    });

    it("should only pay Foo if Foo is sufficiently underpaid", () => {
      const earnings = new Map([
        [foo, ZERO],
        [bar, fromApproximateFloat(99)],
      ]);
      const expectedReceipts = [
        {address: foo, amount: fromApproximateFloat(14)},
      ];
      const expectedDistribution = createLifetimeDistribution(
        timestampMs,
        expectedReceipts,
        strategy
      );
      const actual = distribution(strategy, credHistory, earnings, timestampMs);
      expectDistributionsEqual(expectedDistribution, actual);
    });
    it("should divide according to cred if everyone is already lifetimely paid", () => {
      const earnings = new Map([
        [foo, fromApproximateFloat(5)],
        [bar, fromApproximateFloat(2)],
      ]);

      const expectedReceipts = [
        {address: foo, amount: fromApproximateFloat(10)},
        {address: bar, amount: fromApproximateFloat(4)},
      ];

      const expectedDistribution = createLifetimeDistribution(
        timestampMs,
        expectedReceipts,
        strategy
      );

      const actual = distribution(strategy, credHistory, earnings, timestampMs);
      expectDistributionsEqual(expectedDistribution, actual);
    });
    it("'top off' users who were slightly underpaid'", () => {
      // Foo is exactly 1 grain behind where they "should" be
      const earnings = new Map([
        [foo, fromApproximateFloat(4)],
        [bar, fromApproximateFloat(2)],
      ]);

      const strategy15 = {...strategy, budget: fromApproximateFloat(15)};

      const expectedReceipts = [
        {address: foo, amount: fromApproximateFloat(11)},
        {address: bar, amount: fromApproximateFloat(4)},
      ];

      const expectedDistribution = createLifetimeDistribution(
        timestampMs,
        expectedReceipts,
        strategy15
      );

      const actual = distribution(
        strategy15,
        credHistory,
        earnings,
        timestampMs
      );
      expectDistributionsEqual(expectedDistribution, actual);
    });
    it("should ignore cred scores from the future", () => {
      const middleTimes = 29;

      const strategy12 = {...strategy, budget: fromApproximateFloat(12)};

      // In the last time slice, foo gets 0 cred and bar gets 2
      const expectedReceipts = [
        {address: foo, amount: fromApproximateFloat(10)},
        {address: bar, amount: fromApproximateFloat(2)},
      ];

      const expectedDistribution = createLifetimeDistribution(
        middleTimes,
        expectedReceipts,
        strategy12
      );

      const actual = distribution(
        strategy12,
        credHistory,
        new Map(),
        middleTimes
      );
      expectDistributionsEqual(expectedDistribution, actual);
    });
    it("should handle the case where one user has no historical earnings", () => {
      const earnings = new Map([[foo, fromApproximateFloat(5)]]);

      const expectedReceipts = [
        {address: bar, amount: fromApproximateFloat(2)},
      ];
      const strategy2 = {...strategy, budget: fromApproximateFloat(2)};

      const expectedDistribution = createLifetimeDistribution(
        timestampMs,
        expectedReceipts,
        strategy2
      );

      const actual = distribution(
        strategy2,
        credHistory,
        earnings,
        timestampMs
      );
      expectDistributionsEqual(expectedDistribution, actual);
    });
    it("should not break if a user has earnings but no cred", () => {
      const earnings = new Map([
        [NodeAddress.fromParts(["zoink"]), fromApproximateFloat(10)],
      ]);

      const expectedReceipts = [
        {address: foo, amount: fromApproximateFloat(10)},
        {address: bar, amount: fromApproximateFloat(4)},
      ];

      const expectedDistribution = createLifetimeDistribution(
        timestampMs,
        expectedReceipts,
        strategy
      );

      const actual = distribution(strategy, credHistory, earnings, timestampMs);
      expectDistributionsEqual(expectedDistribution, actual);
    });
  });
});
