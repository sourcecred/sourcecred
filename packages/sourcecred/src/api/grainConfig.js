// @flow

import {type DistributionPolicy} from "../core/ledger/applyDistributions";
import * as C from "../util/combo";
import * as NullUtil from "../util/null";
import * as G from "../core/ledger/grain";
import {
  type AllocationPolicy,
  policyConfigParser,
} from "../core/ledger/policies";
import {
  fromInteger as toNonnegativeGrain,
  numberOrFloatStringParser,
  type NonnegativeGrain,
} from "../core/ledger/nonnegativeGrain";
import {toDiscount} from "../core/ledger/policies/recent";

export type GrainConfig = {|
  +immediatePerWeek?: NonnegativeGrain, // (deprecated)
  +balancedPerWeek?: NonnegativeGrain, // (deprecated)
  +recentPerWeek?: NonnegativeGrain, // (deprecated)
  +recentWeeklyDecayRate?: number, // (deprecated)
  +allocationPolicies?: $ReadOnlyArray<AllocationPolicy>,
  +maxSimultaneousDistributions?: number,
|};

export const parser: C.Parser<GrainConfig> = C.object(
  {},
  {
    allocationPolicies: C.array<AllocationPolicy>(policyConfigParser),
    maxSimultaneousDistributions: C.number,
    immediatePerWeek: numberOrFloatStringParser,
    balancedPerWeek: numberOrFloatStringParser,
    recentPerWeek: numberOrFloatStringParser,
    recentWeeklyDecayRate: C.number,
  }
);

/**
 * Create a DistributionPolicy from GrainConfig, checking that config
 * fields can form valid policies.
 *
 * Moving forward, policies will need to be passed in the `allocationPolicies`
 * parameter; however to avoid backcompatability issues, we optionally allow
 * the deprecated fields for the time being.
 */
export function toDistributionPolicy(x: GrainConfig): DistributionPolicy {
  const allocationPolicies = NullUtil.orElse(x.allocationPolicies, []);
  const POSITIVE_ZERO = toNonnegativeGrain(0);
  const immediatePerWeek = NullUtil.orElse(x.immediatePerWeek, POSITIVE_ZERO);
  const recentPerWeek = NullUtil.orElse(x.recentPerWeek, POSITIVE_ZERO);
  const balancedPerWeek = NullUtil.orElse(x.balancedPerWeek, POSITIVE_ZERO);

  const allocationPoliciesDeprecated = [];
  if (G.gt(immediatePerWeek, G.ZERO)) {
    allocationPoliciesDeprecated.push({
      budget: immediatePerWeek,
      policyType: "IMMEDIATE",
      numIntervalsLookback: 1, // TODO(eli): no customization until after #2600.
    });
  }
  if (G.gt(recentPerWeek, G.ZERO)) {
    const {recentWeeklyDecayRate} = x;
    if (recentWeeklyDecayRate == null) {
      throw new Error(`no recentWeeklyDecayRate specified for recent policy`);
    }
    allocationPoliciesDeprecated.push({
      budget: recentPerWeek,
      policyType: "RECENT",
      discount: toDiscount(recentWeeklyDecayRate),
    });
  }
  if (G.gt(balancedPerWeek, G.ZERO)) {
    allocationPoliciesDeprecated.push({
      budget: balancedPerWeek,
      policyType: "BALANCED",
      numIntervalsLookback: 0, // Zero means use the whole history
    });
  }
  const maxSimultaneousDistributions = NullUtil.orElse(
    x.maxSimultaneousDistributions,
    Infinity
  );
  return {
    allocationPolicies: allocationPolicies.concat(allocationPoliciesDeprecated),
    maxSimultaneousDistributions,
  };
}
