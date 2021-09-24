// @flow

import {parser, toDistributionPolicy, type GrainConfig} from "./grainConfig";
import {type DistributionPolicy} from "../core/ledger/applyDistributions";
import {toDiscount} from "../core/ledger/policies/recent";
import {type Uuid, random as randomUuid} from "../util/uuid";
import {
  fromFloatString,
  fromInteger,
  type NonnegativeGrain,
} from "../core/ledger/nonnegativeGrain";
import {type BalancedPolicy} from "../core/ledger/policies/balanced";
import {type ImmediatePolicy} from "../core/ledger/policies/immediate";
import {type RecentPolicy} from "../core/ledger/policies/recent";
import {type SpecialPolicy} from "../core/ledger/policies/special";
import {nameFromString} from "../core/identity/name";

const toNonnegativeGrain = (budget: number | string): NonnegativeGrain => {
  if (typeof budget === "string") {
    return fromFloatString(budget);
  }
  return fromInteger(budget);
};

const balanced = (budget: number | string): BalancedPolicy => ({
  policyType: "BALANCED",
  budget: toNonnegativeGrain(budget),
  numIntervalsLookback: 0,
});
const immediate = (budget: number | string): ImmediatePolicy => ({
  policyType: "IMMEDIATE",
  budget: toNonnegativeGrain(budget),
  numIntervalsLookback: 1,
});
const recent = (budget: number | string, discount: number): RecentPolicy => ({
  policyType: "RECENT",
  budget: toNonnegativeGrain(budget),
  discount: toDiscount(discount),
  exclusions: [],
});
const special = (
  budget: number | string,
  memo: string,
  recipient: Uuid
): SpecialPolicy => ({
  policyType: "SPECIAL",
  budget: toNonnegativeGrain(budget),
  memo,
  recipient,
});

describe("api/grainConfig", () => {
  describe("parser", () => {
    it("does not throw with no params", () => {
      expect(parser.parseOrThrow({})).toEqual({});
    });

    describe("errors if malformed params", () => {
      it("errors on malformed allocationPolicies", () => {
        const grainConfig = {
          allocationPolicies: {},
          maxSimultaneousDistributions: 2,
        };
        expect(() => parser.parseOrThrow(grainConfig)).toThrowError(
          "expected array, got object"
        );
      });

      it("errors on malformed maxSimultaneousDistributions", () => {
        const grainConfig = {
          allocationPolicies: [],
          maxSimultaneousDistributions: [],
        };
        expect(() => parser.parseOrThrow(grainConfig)).toThrowError(
          "expected number, got array"
        );
      });
    });

    it("ignores extra params", () => {
      const grainConfig = {
        allocationPolicies: [],
        EXTRA: 30,
      };

      const to = {
        allocationPolicies: [],
      };

      expect(parser.parseOrThrow(grainConfig)).toEqual(to);
    });

    it("does not throw on negative maxSimultaneousDistributions", () => {
      const grainConfig = {
        allocationPolicies: [],
        maxSimultaneousDistributions: -5,
      };

      expect(parser.parseOrThrow(grainConfig)).toEqual(grainConfig);
    });

    it("rejects improperly formatted allocation policies", () => {
      const grainConfig = {
        allocationPolicies: [
          {
            policyType: "RECENT",
            budget: 20,
            discount: 1.5,
          },
        ],
        maxSimultaneousDistributions: 2,
      };

      expect(() => parser.parseOrThrow(grainConfig)).toThrowError(
        `Discount must be in range [0,1]`
      );
    });

    it("works on well formed config", () => {
      const uuid = randomUuid();
      const grainConfig = {
        allocationPolicies: [
          {
            policyType: "BALANCED",
            budget: 50,
            numIntervalsLookback: 0,
          },
          {
            policyType: "IMMEDIATE",
            budget: 10,
            numIntervalsLookback: 1,
          },
          {
            policyType: "RECENT",
            budget: 20,
            discount: 0.5,
          },
          {
            policyType: "SPECIAL",
            budget: 100,
            memo: "howdy",
            recipient: uuid,
          },
        ],
        maxSimultaneousDistributions: 2,
        sinkIdentity: "testName",
        processDistributions: true,
      };

      const expected: GrainConfig = {
        allocationPolicies: [
          balanced(50),
          immediate(10),
          recent(20, 0.5),
          special(100, "howdy", uuid),
        ],
        maxSimultaneousDistributions: 2,
        sinkIdentity: nameFromString("testName"),
        processDistributions: true,
      };

      expect(parser.parseOrThrow(grainConfig)).toEqual(expected);
    });

    it("can accept float strings for budgets", () => {
      const uuid = randomUuid();
      const grainConfig = {
        allocationPolicies: [
          {
            policyType: "BALANCED",
            budget: "50.5",
            numIntervalsLookback: 0,
          },
          {
            policyType: "IMMEDIATE",
            budget: "10.1",
            numIntervalsLookback: 1,
          },
          {
            policyType: "RECENT",
            budget: "20.2",
            discount: 0.5,
          },
          {
            policyType: "SPECIAL",
            budget: "100.11",
            memo: "howdy",
            recipient: uuid,
          },
        ],
        maxSimultaneousDistributions: 2,
      };

      const expected: GrainConfig = {
        allocationPolicies: [
          balanced("50.5"),
          immediate("10.1"),
          recent("20.2", 0.5),
          special("100.11", "howdy", uuid),
        ],
        maxSimultaneousDistributions: 2,
      };

      expect(parser.parseOrThrow(grainConfig)).toEqual(expected);
    });

    it("can take multiple of the same policy", () => {
      const config = {
        allocationPolicies: [
          {
            policyType: "RECENT",
            budget: 20,
            discount: 0.1,
          },
          {
            policyType: "RECENT",
            budget: 20,
            discount: 0.1,
          },
        ],
        maxSimultaneousDistributions: 2,
      };

      const expected: GrainConfig = {
        allocationPolicies: [recent(20, 0.1), recent(20, 0.1)],
        maxSimultaneousDistributions: 2,
      };

      expect(parser.parseOrThrow(config)).toEqual(expected);
    });

    it("parses deprecated policy config", () => {
      const inputConfig = {
        allocationPolicies: [],
        balancedPerWeek: 10,
        immediatePerWeek: 20,
        recentPerWeek: 30,
        recentWeeklyDecayRate: 0.5,
        maxSimultaneousDistributions: 100,
      };
      const outputConfig = {
        allocationPolicies: [],
        balancedPerWeek: toNonnegativeGrain(10),
        immediatePerWeek: toNonnegativeGrain(20),
        recentPerWeek: toNonnegativeGrain(30),
        recentWeeklyDecayRate: 0.5,
        maxSimultaneousDistributions: 100,
      };

      expect(parser.parseOrThrow(inputConfig)).toEqual(outputConfig);
    });
  });

  describe("toDistributionPolicy", () => {
    it("deprecated policy config works alongside new config", () => {
      const x: GrainConfig = {
        allocationPolicies: [recent(50, 0.1)],
        immediatePerWeek: toNonnegativeGrain(10),
        recentPerWeek: toNonnegativeGrain(30),
        recentWeeklyDecayRate: 0.5,
        maxSimultaneousDistributions: 10,
      };
      const expected: DistributionPolicy = {
        allocationPolicies: [recent(50, 0.1), immediate(10), recent(30, 0.5)],
        maxSimultaneousDistributions: 10,
      };
      expect(toDistributionPolicy(x)).toEqual(expected);
    });

    it("errors on deprecated recent policy with no discount", () => {
      const x: GrainConfig = {
        recentPerWeek: toNonnegativeGrain(10),
        allocationPolicies: [],
      };

      expect(() => toDistributionPolicy(x)).toThrowError(
        `no recentWeeklyDecayRate specified for recent policy`
      );
    });

    it("can handle missing policies", () => {
      const x: GrainConfig = {
        allocationPolicies: [balanced(50)],
        maxSimultaneousDistributions: 100,
      };

      const expected: DistributionPolicy = {
        allocationPolicies: [balanced(50)],
        maxSimultaneousDistributions: 100,
      };

      expect(toDistributionPolicy(x)).toEqual(expected);
    });

    it("default immediate's numIntervalsLookback to 1", () => {
      const x: GrainConfig = {
        balancedPerWeek: toNonnegativeGrain(0),
        immediatePerWeek: toNonnegativeGrain(100),
        recentPerWeek: toNonnegativeGrain(0),
        recentWeeklyDecayRate: 0.1,
        maxSimultaneousDistributions: 2,
      };

      const expectedDistributionPolicy: DistributionPolicy = {
        allocationPolicies: [
          {
            budget: toNonnegativeGrain(100),
            policyType: "IMMEDIATE",
            numIntervalsLookback: 1,
          },
        ],
        maxSimultaneousDistributions: 2,
      };

      expect(toDistributionPolicy(x)).toEqual(expectedDistributionPolicy);
    });

    it("creates DistributionPolicy from valid GrainConfig", () => {
      const x: GrainConfig = {
        allocationPolicies: [immediate(20), recent(30, 0.1), balanced(10)],
        maxSimultaneousDistributions: 2,
      };

      const expectedDistributionPolicy: DistributionPolicy = {
        allocationPolicies: [immediate(20), recent(30, 0.1), balanced(10)],
        maxSimultaneousDistributions: 2,
      };

      expect(toDistributionPolicy(x)).toEqual(expectedDistributionPolicy);
    });
  });
});
