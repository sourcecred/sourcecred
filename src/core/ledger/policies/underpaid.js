// @flow

import {sum} from "d3-array";
import * as G from "../grain";
import * as P from "../../../util/combo";
import {type GrainReceipt} from "../grainAllocation";
import {type ProcessedIdentities} from "../processedIdentities";

/**
 * The Underpaid policy attempts to get users below some threshold of underpayment
 * as quickly and fairly as possible by reducing the speed at which major
 * contributors get paid.  As the amount of underpayment increases, the marginal
 * increase in their payment will taper off.
 *
 * Underpaid uses Balanced to calculate lifetime underpayment, and expands on it
 * in two ways. First, it allows quadratic scaling of allocated Grain amounts.
 * This avoids massively underpaid contributors from being paid right away at
 * the expense of others.
 *
 * Second, Underpaid has a threshold parameter which sets the minimum amount a
 * contributor must be underpaid in order to qualify for a payment.  When using
 * quadratic scaling, small amounts allocated to many users can potentially
 * eat an undesirably larger proportion of the budget.
 *
 * Note, Underpaid with a threshold of 0 and an exponent of 1 is equivalent to
 * the Balanced policy.
 */
export type Underpaid = "UNDERPAID";

export type UnderpaidPolicy = {|
  +policyType: Underpaid,
  +budget: G.Grain,
  +threshold: G.Grain,
  +exponent: number,
|};

/**
 * Allocate a fixed budget of Grain to the users who were "most underpaid" owed
 * at least {threshold} grain.
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
 * underpayment, we:
 * 1. Filter out users whose underpayment < {threshold}.
 * 2. Quadratically scale underpayments to the power of {exponent}.
 *
 * Finally we divide the allocation's grain budget across users in
 * proportion to their adjusted underpayment.
 *
 * You should use this allocation when you want to divide a fixed budget of grain
 * across participants in order to keep them below a reasonable threshold of
 * underpayment with respect to total cred, and/or when large contributors have
 * the potential to monopolize a Balanced allocation.
 */
export function underpaidReceipts(
  budget: G.Grain,
  identities: ProcessedIdentities,
  threshold: G.Grain,
  exponent: number
): $ReadOnlyArray<GrainReceipt> {
  if (G.lt(threshold, G.ZERO)) {
    throw new Error(`threshold must be >= 0, got ${threshold}`);
  }
  if (exponent <= 0 || exponent > 1) {
    throw new Error(`exponent must be in range (0, 1], got ${exponent}`);
  }

  const totalCred = sum(identities.map((x) => x.lifetimeCred));
  const totalEverPaid = G.sum(identities.map((i) => i.paid));

  const targetTotalDistributed = G.add(totalEverPaid, budget);
  const targetGrainPerCred = G.multiplyFloat(
    targetTotalDistributed,
    1 / totalCred
  );

  const userUnderpayment = identities.map(({paid, lifetimeCred}) => {
    const target = G.multiplyFloat(targetGrainPerCred, lifetimeCred);
    return G.gt(target, G.add(paid, threshold)) ? G.sub(target, paid) : G.ZERO;
  });

  const floatUnderpayment = userUnderpayment.map(Number);
  const quadraticUnderPayment = floatUnderpayment.map((x) =>
    Math.pow(x, exponent)
  );

  if (sum(quadraticUnderPayment) === 0)
    return identities.map(({id}) => ({id, amount: G.ZERO}));

  const grainAmounts = G.splitBudget(budget, quadraticUnderPayment);
  return identities.map(({id}, i) => ({id, amount: grainAmounts[i]}));
}

export const underpaidPolicyParser: P.Parser<UnderpaidPolicy> = P.object({
  policyType: P.exactly(["UNDERPAID"]),
  budget: G.parser,
  threshold: G.parser,
  exponent: P.number,
});
