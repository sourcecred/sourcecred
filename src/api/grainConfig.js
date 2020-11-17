// @flow

import {type DistributionPolicy} from "../core/ledger/applyDistributions";
import * as G from "../core/ledger/grain";
import * as C from "../util/combo";
import * as NullUtil from "../util/null";
import {toDiscount} from "../core/ledger/policies/recent";

export type GrainConfig = {|
  +immediatePerWeek: number,
  +recentPerWeek: number,
  +balancedPerWeek: number,
  +recentWeeklyDecayRate?: number,
  +maxSimultaneousDistributions?: number,
|};

/**
 * Used by parser to zero missing budgets.
 */
export function zeroMissingBudgets(x: Object): GrainConfig {
  return {
    balancedPerWeek: NullUtil.orElse(x.balancedPerWeek, 0),
    immediatePerWeek: NullUtil.orElse(x.immediatePerWeek, 0),
    recentPerWeek: NullUtil.orElse(x.recentPerWeek, 0),
    recentWeeklyDecayRate: x.recentWeeklyDecayRate,
    maxSimultaneousDistributions: x.maxSimultaneousDistributions,
  };
}

export const parser: C.Parser<GrainConfig> = C.fmap(
  C.object(
    {},
    {
      immediatePerWeek: C.number,
      recentPerWeek: C.number,
      balancedPerWeek: C.number,
      recentWeeklyDecayRate: C.number,
      maxSimultaneousDistributions: C.number,
    }
  ),
  zeroMissingBudgets
);

export function toDistributionPolicy(x: GrainConfig): DistributionPolicy {
  if (!isNonnegativeInteger(x.immediatePerWeek)) {
    throw new Error(
      `immediate budget must be nonnegative integer, got ${x.immediatePerWeek}`
    );
  }
  if (!isNonnegativeInteger(x.recentPerWeek)) {
    throw new Error(
      `recent budget must be nonnegative integer, got ${x.recentPerWeek}`
    );
  }
  if (!isNonnegativeInteger(x.balancedPerWeek)) {
    throw new Error(
      `balanced budget must be nonnegative integer, got ${x.balancedPerWeek}`
    );
  }
  const allocationPolicies = [];
  if (x.immediatePerWeek > 0) {
    allocationPolicies.push({
      budget: G.fromInteger(x.immediatePerWeek),
      policyType: "IMMEDIATE",
    });
  }
  if (x.recentPerWeek > 0) {
    const {recentWeeklyDecayRate} = x;
    if (recentWeeklyDecayRate == null) {
      throw new Error(`no recentWeeklyDecayRate specified for recent policy`);
    }
    allocationPolicies.push({
      budget: G.fromInteger(x.recentPerWeek),
      policyType: "RECENT",
      discount: toDiscount(recentWeeklyDecayRate),
    });
  }
  if (x.balancedPerWeek > 0) {
    allocationPolicies.push({
      budget: G.fromInteger(x.balancedPerWeek),
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
