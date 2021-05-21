// @flow

import * as G from "../grain";
import * as P from "../../../util/combo";
import {type GrainReceipt} from "../grainAllocation";
import {type ProcessedIdentities} from "../processedIdentities";
import {
  type NonnegativeGrain,
  grainParser,
  numberOrFloatStringParser,
} from "../nonnegativeGrain";

/**
 * The Immediate policy evenly distributes its Grain budget across users
 * based on their Cred in the most recent interval.
 *
 * It's used when you want to ensure that everyone gets some consistent reward
 * for participating (even if they may be "overpaid" in a lifetime sense).
 * We recommend using a smaller budget for the Immediate policy.
 */
export type Immediate = "IMMEDIATE";

export type ImmediatePolicy = {|
  +policyType: Immediate,
  +budget: NonnegativeGrain,
  +numIntervalsLookback: number,
|};

/**
 * Split a grain budget in proportion to the cred scores in
 * the most recent time interval, with the option to extend the interval
 * to include the last {numIntervalsLookback} weeks.
 */
export function immediateReceipts(
  policy: ImmediatePolicy,
  identities: ProcessedIdentities
): $ReadOnlyArray<GrainReceipt> {
  // Default to 1 interval to preserve back-compat with old ledger events

  if (policy.numIntervalsLookback < 1) {
    throw new Error(
      `numIntervalsLookback must be at least 1, got ${policy.numIntervalsLookback}`
    );
  }
  if (!Number.isInteger(policy.numIntervalsLookback)) {
    throw new Error(
      `numIntervalsLookback must be an integer, got ${policy.numIntervalsLookback}`
    );
  }

  const totalIntervals = identities[0].cred.length;
  const shortTermCredPerIdentity = identities.map(({cred}) =>
    cred
      .slice(
        cred.length - Math.min(policy.numIntervalsLookback, totalIntervals)
      )
      .reduce((sum, cred) => sum + cred, 0)
  );

  const amounts = G.splitBudget(policy.budget, shortTermCredPerIdentity);
  return identities.map(({id}, i) => ({id, amount: amounts[i]}));
}

export const immediateConfigParser: P.Parser<ImmediatePolicy> = P.object({
  policyType: P.exactly(["IMMEDIATE"]),
  budget: numberOrFloatStringParser,
  numIntervalsLookback: P.number,
});

export const immediatePolicyParser: P.Parser<ImmediatePolicy> = P.fmap(
  P.object(
    {
      policyType: P.exactly(["IMMEDIATE"]),
      budget: grainParser,
    },
    {
      numIntervalsLookback: P.number,
    }
  ),
  (policy) => ({
    ...policy,
    numIntervalsLookback:
      policy.numIntervalsLookback != null ? policy.numIntervalsLookback : 1,
  })
);

export function toString(policy: ImmediatePolicy): string {
  return [
    policy.policyType + " Policy",
    "Budget " + G.format(policy.budget, 3),
  ].join(`\n`);
}
