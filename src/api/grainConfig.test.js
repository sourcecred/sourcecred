// @flow

import {parser, toDistributionPolicy, type GrainConfig} from "./grainConfig";
import {type DistributionPolicy} from "../core/ledger/applyDistributions";
import {toDiscount} from "../core/ledger/policies/recent";
import {fromInteger} from "../core/ledger/grain";

describe("api/grainConfig", () => {
  describe("parser", () => {
    it("does not throw with no params", () => {
      expect(parser.parseOrThrow({})).toEqual({});
    });

    it("errors if malformed params", () => {
      const grainConfig = {
        balancedPerWeek: {},
        immediatePerWeek: 10,
        recentPerWeek: 10,
      };
      expect(() => parser.parseOrThrow(grainConfig)).toThrowError(
        "expected number"
      );
    });

    it("ignores extra params", () => {
      const grainConfig = {
        recentPerWeek: 30,
        EXTRA: 30,
      };

      const to = {
        recentPerWeek: 30,
      };

      expect(parser.parseOrThrow(grainConfig)).toEqual(to);
    });

    it("does not throw on negative or zero budgets", () => {
      const grainConfig = {
        balancedPerWeek: -1,
        immediatePerWeek: 0,
        recentPerWeek: -100,
        recentWeeklyDecayRate: 0.5,
      };

      expect(parser.parseOrThrow(grainConfig)).toEqual(grainConfig);
    });

    it("works with missing policy parameters", () => {
      const grainConfig = {
        balancedPerWeek: 10,
        underpaidPerWeek: 100,
        immediatePerWeek: 20,
        recentPerWeek: 30,
        recentWeeklyDecayRate: 0.5,
      };
      expect(parser.parseOrThrow(grainConfig)).toEqual(grainConfig);
    });

    it("works on well formed object", () => {
      const grainConfig = {
        balancedPerWeek: 10,
        underpaidPerWeek: 100,
        immediatePerWeek: 20,
        recentPerWeek: 30,
        recentWeeklyDecayRate: 0.5,
        underpaidThreshold: 50,
        underpaidExponent: 0.5,
        maxSimultaneousDistributions: 10,
      };

      expect(parser.parseOrThrow(grainConfig)).toEqual(grainConfig);
    });
  });

  describe("toDistributionPolicy", () => {
    it("can handle missing policies", () => {
      const x: GrainConfig = {
        maxSimultaneousDistributions: 100,
      };

      const expected: DistributionPolicy = {
        allocationPolicies: [],
        maxSimultaneousDistributions: 100,
      };

      expect(toDistributionPolicy(x)).toEqual(expected);
    });

    describe("recent policy parameters", () => {
      it("errors on missing discount for recent policy", () => {
        const x: GrainConfig = {
          balancedPerWeek: 10,
          immediatePerWeek: 20,
          recentPerWeek: 10,
        };

        expect(() => toDistributionPolicy(x)).toThrowError(
          "no recentWeeklyDecayRate specified"
        );
      });
    });

    describe("underpaid policy parameters", () => {
      it("errors on missing threshold for underpaid policy", () => {
        const x: GrainConfig = {
          underpaidPerWeek: 100,
          underpaidExponent: 0.5,
        };

        expect(() => toDistributionPolicy(x)).toThrowError(
          "no threshold specified"
        );
      });
      it("errors on missing exponent for underpaid policy", () => {
        const x: GrainConfig = {
          underpaidPerWeek: 100,
          underpaidThreshold: 10,
        };

        expect(() => toDistributionPolicy(x)).toThrowError(
          "no exponent specified"
        );
      });
    });

    it("does not error for missing recentWeeklyDecayRate if 0 recent budget", () => {
      const x: GrainConfig = {
        balancedPerWeek: 10,
        immediatePerWeek: 20,
        recentPerWeek: 0,
      };

      expect(() => toDistributionPolicy(x)).not.toThrow();
    });

    it("creates DistributionPolicy from valid GrainConfig", () => {
      const x: GrainConfig = {
        balancedPerWeek: 10,
        immediatePerWeek: 20,
        recentPerWeek: 30,
        recentWeeklyDecayRate: 0.1,
        maxSimultaneousDistributions: 2,
      };

      const expectedDistributionPolicy: DistributionPolicy = {
        allocationPolicies: [
          {
            budget: fromInteger(20),
            policyType: "IMMEDIATE",
          },
          {
            budget: fromInteger(30),
            policyType: "RECENT",
            discount: toDiscount(0.1),
          },
          {
            budget: fromInteger(10),
            policyType: "BALANCED",
          },
        ],
        maxSimultaneousDistributions: 2,
      };

      expect(toDistributionPolicy(x)).toEqual(expectedDistributionPolicy);
    });
  });
});
