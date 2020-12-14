// @flow

import {parser, toDistributionPolicy, type GrainConfig} from "./grainConfig";
import {type DistributionPolicy} from "../core/ledger/applyDistributions";
import {toDiscount} from "../core/ledger/policies/recent";
import {type Uuid, random as randomUuid} from "../util/uuid";
import {fromInteger as toNonnegativeGrain} from "../core/ledger/policies/nonnegativeGrain";
import {type BalancedPolicy} from "../core/ledger/policies/balanced";
import {type ImmediatePolicy} from "../core/ledger/policies/immediate";
import {type RecentPolicy} from "../core/ledger/policies/recent";
import {type SpecialPolicy} from "../core/ledger/policies/special";

const balanced = (budget: number): BalancedPolicy => ({
  policyType: "BALANCED",
  budget: toNonnegativeGrain(budget),
});
const immediate = (budget: number): ImmediatePolicy => ({
  policyType: "IMMEDIATE",
  budget: toNonnegativeGrain(budget),
});
const recent = (budget: number, discount: number): RecentPolicy => ({
  policyType: "RECENT",
  budget: toNonnegativeGrain(budget),
  discount: toDiscount(discount),
});
const special = (
  budget: number,
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
    it("errors if missing allocationPolicies key", () => {
      expect(() => parser.parseOrThrow({})).toThrowError(`missing key`);
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
          },
          {
            policyType: "IMMEDIATE",
            budget: 10,
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
      };

      const expected: GrainConfig = {
        allocationPolicies: [
          balanced(50),
          immediate(10),
          recent(20, 0.5),
          special(100, "howdy", uuid),
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
      const config = {
        balancedPerWeek: 10,
        immediatePerWeek: 20,
        recentPerWeek: 30,
        allocationPolicies: [],
      };

      expect(parser.parseOrThrow(config)).toEqual(config);
    });
  });

  describe("toDistributionPolicy", () => {
    it("deprecated policy config works alongside new config", () => {
      const x: GrainConfig = {
        allocationPolicies: [recent(50, 0.1)],
        recentPerWeek: 30,
        recentWeeklyDecayRate: 0.5,
        maxSimultaneousDistributions: 10,
      };
      const expected: DistributionPolicy = {
        allocationPolicies: [recent(50, 0.1), recent(30, 0.5)],
        maxSimultaneousDistributions: 10,
      };
      expect(toDistributionPolicy(x)).toEqual(expected);
    });

    it("errors on deprecated allocation policy with negative budget", () => {
      const x: GrainConfig = {
        balancedPerWeek: -1,
        allocationPolicies: [],
      };

      expect(() => toDistributionPolicy(x)).toThrowError(
        `budget must be nonnegative integer`
      );
    });

    it("deprecated recent policy with no discount errors", () => {
      const x: GrainConfig = {
        recentPerWeek: 10,
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

    it("creates DistributionPolicy with at least 1 allocation policy with positive budgets", () => {
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
