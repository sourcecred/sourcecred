// @flow

import * as G from "../grain";
import * as P from "../../../util/combo";
import {type GrainReceipt} from "../grainAllocation";
import {type ProcessedIdentities} from "../processedIdentities";

/**
 * The Immediate policy evenly distributes its Grain budget
 * across users based on their Cred in the most recent interval.
 *
 * It's used when you want to ensure that everyone gets some consistent reward
 * for participating (even if they may be "overpaid" in a lifetime sense).
 * We recommend using a smaller budget for the Immediate policy.
 */
export type Immediate = "IMMEDIATE";

export type ImmediatePolicy = {|
  +policyType: Immediate,
  +budget: G.Grain,
  +numPeriodsLookback: number,
|};

/**
 * Split a grain budget in proportion to the cred scores in
 * the most recent time interval, with the option to extend the interval
 * to include the last {numPeriodsLookback} weeks.
 */
export function immediateReceipts(
  policy: ImmediatePolicy,
  identities: ProcessedIdentities
): $ReadOnlyArray<GrainReceipt> {
  if (policy.numPeriodsLookback < 1) {
    throw new Error(
      `numPeriodsLookback must be at least 1, got ${policy.numPeriodsLookback}`
    );
  }
  if (!Number.isInteger(policy.numPeriodsLookback)) {
    throw new Error(
      `numPeriodsLookback must be an integer, got ${policy.numPeriodsLookback}`
    );
  }

  const totalIntervals = identities[0].cred.length;
  const shortTermCredPerIdentity = identities.map(({cred}) =>
    cred
      .slice(cred.length - Math.min(policy.numPeriodsLookback, totalIntervals))
      .reduce((sum, cred) => sum + cred, 0)
  );

  const amounts = G.splitBudget(policy.budget, shortTermCredPerIdentity);
  return identities.map(({id}, i) => ({id, amount: amounts[i]}));
}

export const immediatePolicyParser: P.Parser<ImmediatePolicy> = P.object({
  policyType: P.exactly(["IMMEDIATE"]),
  budget: G.parser,
  numPeriodsLookback: P.number,
});
