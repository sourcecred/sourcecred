// @flow

import {type DistributionPolicy} from "../core/ledger/applyDistributions";
import * as G from "../core/ledger/grain";
import * as C from "../util/combo";
import * as NullUtil from "../util/null";
import {toDiscount} from "../core/ledger/policies/recent";

export type GrainConfig = {|
  +immediatePerWeek?: number,
  +balancedPerWeek?: number,
  +underpaidPerWeek?: number,
  +recentPerWeek?: number,
  +recentWeeklyDecayRate?: number,
  +maxSimultaneousDistributions?: number,
  +underpaidThreshold?: number,
  +underpaidExponent?: number,
|};

export const parser: C.Parser<GrainConfig> = C.object(
  {},
  {
    immediatePerWeek: C.number,
    balancedPerWeek: C.number,
    underpaidPerWeek: C.number,
    recentPerWeek: C.number,
    recentWeeklyDecayRate: C.number,
    underpaidThreshold: C.number,
    underpaidExponent: C.number,
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
  const underpaidPerWeek = NullUtil.orElse(x.underpaidPerWeek, 0);

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
  if (!isNonnegativeInteger(underpaidPerWeek)) {
    throw new Error(
      `underpaid budget must be nonnegative integer, got ${balancedPerWeek}`
    );
  }
  const allocationPolicies = [];
  if (immediatePerWeek > 0) {
    allocationPolicies.push({
      budget: G.fromInteger(immediatePerWeek),
      policyType: "IMMEDIATE",
    });
  }
  if (recentPerWeek > 0) {
    const {recentWeeklyDecayRate} = x;
    if (recentWeeklyDecayRate == null) {
      throw new Error(`no recentWeeklyDecayRate specified for recent policy`);
    }
    allocationPolicies.push({
      budget: G.fromInteger(recentPerWeek),
      policyType: "RECENT",
      discount: toDiscount(recentWeeklyDecayRate),
    });
  }
  if (balancedPerWeek > 0) {
    allocationPolicies.push({
      budget: G.fromInteger(balancedPerWeek),
      policyType: "BALANCED",
    });
  }
  if (underpaidPerWeek > 0) {
    const {underpaidThreshold, underpaidExponent: exponent} = x;
    if (underpaidThreshold == null) {
      throw new Error(`no threshold specified for underpaid policy`);
    }

    if (exponent == null) {
      throw new Error(`no exponent specified for underpaid policy`);
    }

    allocationPolicies.push({
      budget: G.fromInteger(underpaidPerWeek),
      policyType: "UNDERPAID",
      threshold: G.fromApproximateFloat(underpaidThreshold),
      exponent,
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
