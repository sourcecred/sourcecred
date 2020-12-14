// @flow

import {sum} from "d3-array";
import * as G from "../grain";
import * as P from "../../../util/combo";
import {type GrainReceipt} from "../grainAllocation";
import {type ProcessedIdentities} from "../processedIdentities";
import {
  type NonnegativeGrain,
  numberParser,
  grainParser,
} from "./nonnegativeGrain";

/**
 * The Balanced policy attempts to pay Grain to everyone so that their
 * lifetime Grain payouts are consistent with their lifetime Cred scores.
 *
 * We recommend use of the Balanced strategy as it takes new information into
 * account-- for example, if a user's contributions earned little Cred in the
 * past, but are now seen as more valuable, the Balanced policy will take this
 * into account and pay them more, to fully appreciate their past
 * contributions.
 */
export type Balanced = "BALANCED";

export type BalancedPolicy = {|
  +policyType: Balanced,
  +budget: NonnegativeGrain,
|};

/**
 * Allocate a fixed budget of Grain to the users who were "most underpaid".
 *
 * We consider a user underpaid if they have received a smaller proportion of
 * past earnings than their share of score. They are balanced paid if their
 * proportion of earnings is equal to their score share, and they are overpaid
 * if their proportion of earnings is higher than their share of the score.
 *
 * We start by imagining a hypothetical world, where the entire grain supply of
 * the project (including this allocation) was allocated according to the
 * current scores. Based on this, we can calculate the "balanced" lifetime earnings
 * for each participant. Usually, some will be "underpaid" (they received less
 * than this amount) and others are "overpaid".
 *
 * We can sum across all users who were underpaid to find the "total
 * underpayment".
 *
 * Now that we've calculated each actor's underpayment, and the total
 * underpayment, we divide the allocation's grain budget across users in
 * proportion to their underpayment.
 *
 * You should use this allocation when you want to divide a fixed budget of grain
 * across participants in a way that aligns long-term payment with total cred
 * scores.
 */
export function balancedReceipts(
  budget: G.Grain,
  identities: ProcessedIdentities
): $ReadOnlyArray<GrainReceipt> {
  const totalCred = sum(identities.map((x) => x.lifetimeCred));
  const totalEverPaid = G.sum(identities.map((i) => i.paid));

  const targetTotalDistributed = G.add(totalEverPaid, budget);
  const targetGrainPerCred = G.multiplyFloat(
    targetTotalDistributed,
    1 / totalCred
  );

  const userUnderpayment = identities.map(({paid, lifetimeCred}) => {
    const target = G.multiplyFloat(targetGrainPerCred, lifetimeCred);
    if (G.gt(target, paid)) {
      return G.sub(target, paid);
    } else {
      return G.ZERO;
    }
  });

  const floatUnderpayment = userUnderpayment.map((x) => Number(x));

  const grainAmounts = G.splitBudget(budget, floatUnderpayment);
  return identities.map(({id}, i) => ({id, amount: grainAmounts[i]}));
}

export const balancedConfigParser: P.Parser<BalancedPolicy> = P.object({
  policyType: P.exactly(["BALANCED"]),
  budget: numberParser,
});

export const balancedPolicyParser: P.Parser<BalancedPolicy> = P.object({
  policyType: P.exactly(["BALANCED"]),
  budget: grainParser,
});
