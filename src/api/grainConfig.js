// @flow

import {type DistributionPolicy} from "../core/ledger/applyDistributions";
import * as G from "../core/ledger/grain";
import * as C from "../util/combo";
import * as NullUtil from "../util/null";
import {
  type AllocationPolicy,
  allocationPolicyParser,
} from "../core/ledger/grainAllocation";

export type GrainConfig = {|
  +allocationPolicies: $ReadOnlyArray<AllocationPolicy>,
  +maxSimultaneousDistributions?: number,
|};

export const parser: C.Parser<GrainConfig> = C.object(
  {
    allocationPolicies: C.array<AllocationPolicy>(allocationPolicyParser),
  },
  {
    maxSimultaneousDistributions: C.number,
  }
);

export function toDistributionPolicy(x: GrainConfig): DistributionPolicy {
  if (!x.allocationPolicies.length) {
    throw new Error(`no valid allocation policies provided`);
  }
  x.allocationPolicies.map((policy) => {
    if (!G.gt(policy.budget, G.ZERO)) {
      throw new Error(
        `${policy.policyType} budget must be nonnegative integer, got ${policy.budget}`
      );
    }
  });
  const maxSimultaneousDistributions = NullUtil.orElse(
    x.maxSimultaneousDistributions,
    Infinity
  );
  return {
    allocationPolicies: x.allocationPolicies,
    maxSimultaneousDistributions,
  };
}
