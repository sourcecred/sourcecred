// @flow

import {type DistributionPolicy} from "../core/ledger/applyDistributions";
import * as C from "../util/combo";
import * as NullUtil from "../util/null";
import {fromInteger as toNonnegativeGrain} from "../core/ledger/nonnegativeGrain";
import {toDiscount} from "../core/ledger/policies/recent";

export type GrainConfig = {|
  +immediatePerWeek?: number,
  +balancedPerWeek?: number,
  +recentPerWeek?: number,
  +recentWeeklyDecayRate?: number,
  +maxSimultaneousDistributions?: number,
|};

export const parser: C.Parser<GrainConfig> = C.object(
  {},
  {
    immediatePerWeek: C.number,
    balancedPerWeek: C.number,
    recentPerWeek: C.number,
    recentWeeklyDecayRate: C.number,
    maxSimultaneousDistributions: C.number,
  }
);

/**
 * Create a DistributionPolicy from GrainConfig, checking that config
 * fields can form valid policies.
 */
export function toDistributionPolicy(x: GrainConfig): DistributionPolicy {
  const immediatePerWeek = NullUtil.orElse(x.immediatePerWeek, 0);
  const recentPerWeek = NullUtil.orElse(x.recentPerWeek, 0);
  const balancedPerWeek = NullUtil.orElse(x.balancedPerWeek, 0);

  if (!isNonnegativeInteger(immediatePerWeek)) {
    throw new Error(
      `immediate budget must be nonnegative integer, got ${immediatePerWeek}`
    );
  }
  if (!isNonnegativeInteger(recentPerWeek)) {
    throw new Error(
      `recent budget must be nonnegative integer, got ${recentPerWeek}`
    );
  }
  if (!isNonnegativeInteger(balancedPerWeek)) {
    throw new Error(
      `balanced budget must be nonnegative integer, got ${balancedPerWeek}`
    );
  }

  const allocationPolicies = [];
  if (immediatePerWeek > 0) {
    allocationPolicies.push({
      budget: toNonnegativeGrain(immediatePerWeek),
      policyType: "IMMEDIATE",
    });
  }
  if (recentPerWeek > 0) {
    const {recentWeeklyDecayRate} = x;
    if (recentWeeklyDecayRate == null) {
      throw new Error(`no recentWeeklyDecayRate specified for recent policy`);
    }
    allocationPolicies.push({
      budget: toNonnegativeGrain(recentPerWeek),
      policyType: "RECENT",
      discount: toDiscount(recentWeeklyDecayRate),
    });
  }
  if (balancedPerWeek > 0) {
    allocationPolicies.push({
      budget: toNonnegativeGrain(balancedPerWeek),
      policyType: "BALANCED",
    });
  }
  const maxSimultaneousDistributions = NullUtil.orElse(
    x.maxSimultaneousDistributions,
    Infinity
  );
  return {allocationPolicies, maxSimultaneousDistributions};
}

function isNonnegativeInteger(x: number): boolean {
  return x >= 0 && isFinite(x) && Math.floor(x) === x;
}
