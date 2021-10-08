// @flow

import {transform, oldParser} from "./v0_10_0";

describe("cli/update/v0_10_0", () => {
  it("transforms legacy configs", () => {
    const before = oldParser.parseOrThrow({
      "immediatePerWeek": 0,
      "balancedPerWeek": 5000,
      "recentPerWeek": 20000,
      "recentWeeklyDecayRate": 0.16,
      "maxSimultaneousDistributions": 100,
    });
    const expected = {
      maxSimultaneousDistributions: 100,
      allocationPolicies: [
        {
          policyType: "RECENT",
          budget: "20000",
          discount: 0.16,
        },
        {
          policyType: "BALANCED",
          budget: "5000",
          numIntervalsLookback: 0,
        },
      ],
    };
    expect(transform(before)).toEqual(expected);
  });

  it("transforms modern configs", () => {
    const before = oldParser.parseOrThrow({
      "maxSimultaneousDistributions": 100,
      "allocationPolicies": [
        {
          "policyType": "RECENT",
          "budget": 100,
          "discount": 0.16,
        },
        {
          "policyType": "RECENT",
          "budget": "100",
          "discount": 0.16,
          "exclusions": [],
        },
      ],
    });
    const expected = {
      maxSimultaneousDistributions: 100,
      allocationPolicies: [
        {
          policyType: "RECENT",
          budget: 100,
          discount: 0.16,
        },
        {
          policyType: "RECENT",
          budget: "100",
          discount: 0.16,
          exclusions: [],
        },
      ],
    };
    expect(transform(before)).toEqual(expected);
  });

  it("transforms empty configs", () => {
    const before = oldParser.parseOrThrow({});
    const expected = {
      allocationPolicies: [],
    };
    expect(transform(before)).toEqual(expected);
  });
});
