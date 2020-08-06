// @flow

import {type DistributionPolicy} from "../ledger/applyDistributions";
import * as G from "../ledger/grain";
import * as C from "../util/combo";
import * as NullUtil from "../util/null";
import * as N from "../util/numerics";

export type GrainConfig = {|
  +immediatePerWeek: N.NonnegativeInteger,
  +balancedPerWeek: N.NonnegativeInteger,
  +maxSimultaneousDistributions?: number,
|};

export const parser: C.Parser<GrainConfig> = C.object(
  {
    immediatePerWeek: N.nonnegativeIntegerParser,
    balancedPerWeek: N.nonnegativeIntegerParser,
  },
  {
    maxSimultaneousDistributions: C.number,
  }
);

export function toDistributionPolicy(x: GrainConfig): DistributionPolicy {
  const allocationPolicies = [];
  if (x.immediatePerWeek > 0) {
    allocationPolicies.push({
      budget: G.fromInteger(x.immediatePerWeek),
      policyType: "IMMEDIATE",
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
