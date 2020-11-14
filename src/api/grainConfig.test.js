// @flow

import {parser, toDistributionPolicy, type GrainConfig} from "./grainConfig";
import {type DistributionPolicy} from "../core/ledger/applyDistributions";
import {toDiscount} from "../core/ledger/grainAllocation";
import {fromString} from "../core/ledger/grain";
import {random as randomUuid} from "../util/uuid.js";

describe("api/grainConfig", () => {
  describe("parser", () => {
    it("works with valid config", () => {
      const uuid = randomUuid();
      const config = {
        allocationPolicies: [
          {
            policyType: "BALANCED",
            budget: "50", // TODO: need to make this parse a number
          },
          {
            policyType: "IMMEDIATE",
            budget: "10",
          },
          {
            policyType: "RECENT",
            budget: "20",
            discount: 0.1,
          },
          {
            policyType: "RECENT",
            budget: "30",
            discount: 0.2,
          },
          {
            policyType: "SPECIAL",
            budget: "100",
            memo: "howdy",
            recipient: uuid,
          },
        ],
        maxSimultaneousDistributions: 2,
      };
      const expected: GrainConfig = {
        allocationPolicies: [
          {
            policyType: "BALANCED",
            budget: fromString("50"),
          },
          {
            policyType: "IMMEDIATE",
            budget: fromString("10"),
          },
          {
            policyType: "RECENT",
            budget: fromString("20"),
            discount: toDiscount(0.1),
          },
          {
            policyType: "RECENT",
            budget: fromString("30"),
            discount: toDiscount(0.2),
          },
          {
            policyType: "SPECIAL",
            budget: fromString("100"),
            memo: "howdy",
            recipient: uuid,
          },
        ],
        maxSimultaneousDistributions: 2,
      };
      expect(parser.parseOrThrow(config)).toEqual(expected);
    });

    it("can take multiple of the same policy", () => {
      const config = {
        allocationPolicies: [
          {
            policyType: "RECENT",
            budget: "20",
            discount: 0.1,
          },
          {
            policyType: "RECENT",
            budget: "30",
            discount: 0.2,
          },
        ],
        maxSimultaneousDistributions: 2,
      };
      const expected: GrainConfig = {
        allocationPolicies: [
          {
            policyType: "RECENT",
            budget: fromString("20"),
            discount: toDiscount(0.1),
          },
          {
            policyType: "RECENT",
            budget: fromString("30"),
            discount: toDiscount(0.2),
          },
        ],
        maxSimultaneousDistributions: 2,
      };
      expect(parser.parseOrThrow(config)).toEqual(expected);
    });

    it("errors on invalid discount", () => {
      const config = {
        allocationPolicies: [
          {
            policyType: "RECENT",
            budget: "-1",
            discount: -5,
          },
        ],
        maxSimultaneousDistributions: 2,
      };
      expect(() => parser.parseOrThrow(config)).toThrowError(
        "Discount must be in range"
      );
    });
  });

  describe("toDistributionPolicy", () => {
    it("errors if non positive budget", () => {
      const x: GrainConfig = {
        allocationPolicies: [
          {
            policyType: "BALANCED",
            budget: fromString("0"),
          },
        ],
      };
      expect(() => toDistributionPolicy(x)).toThrowError(
        `budget must be nonnegative integer`
      );
    });

    it("errors if no policies provided", () => {
      const x: GrainConfig = {
        allocationPolicies: [],
      };
      expect(() => toDistributionPolicy(x)).toThrowError(
        `no valid allocation policies provided`
      );
    });

    it("creates DistributionPolicy from valid GrainConfig", () => {
      const x: GrainConfig = {
        allocationPolicies: [
          {
            policyType: "BALANCED",
            budget: fromString("50"),
          },
          {
            policyType: "IMMEDIATE",
            budget: fromString("10"),
          },
          {
            policyType: "RECENT",
            budget: fromString("20"),
            discount: toDiscount(0.1),
          },
          {
            policyType: "RECENT",
            budget: fromString("30"),
            discount: toDiscount(0.2),
          },
        ],
        maxSimultaneousDistributions: 2,
      };

      const expectedDistributionPolicy: DistributionPolicy = {
        allocationPolicies: [
          {
            policyType: "BALANCED",
            budget: fromString("50"),
          },
          {
            policyType: "IMMEDIATE",
            budget: fromString("10"),
          },
          {
            policyType: "RECENT",
            budget: fromString("20"),
            discount: toDiscount(0.1),
          },
          {
            policyType: "RECENT",
            budget: fromString("30"),
            discount: toDiscount(0.2),
          },
        ],
        maxSimultaneousDistributions: 2,
      };

      expect(toDistributionPolicy(x)).toEqual(expectedDistributionPolicy);
    });
  });
});
