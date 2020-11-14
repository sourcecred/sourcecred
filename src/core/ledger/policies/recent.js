// @flow

import * as G from "../grain";
import * as P from "../../../util/combo";
import {type GrainReceipt} from "../grainAllocation";
import {type ProcessedIdentities} from "../processedIdentities";

/**
 * The Recent policy distributes cred using a time discount factor, weighing
 * recent contributions higher. The policy takes a history of cred scores, progressively
 * discounting past cred scores, and then taking the sum over the discounted scores.
 *
 * A cred score at time t reads as follows: "The discounted cred c' at a timestep which is
 * n timesteps back from the most recent one is its cred score c multiplied by the discount
 * factor to the nth power."
 *
 * c' =  c * (1 - discount) ** n
 *
 * Discounts range from 0 to 1, with a higher discount weighing recent contribution
 * higher.
 *
 * Note that this is a generalization of the Immediate policy, where Immediate
 * is the same as Recent with a full discount, i.e. a discount factor 1 (100%).
 *
 */
export type Recent = "RECENT";

export type RecentPolicy = {|
  +policyType: Recent,
  +budget: G.Grain,
  +discount: Discount,
|};

/**
 * Split a grain budget based on exponentially weighted recent
 * cred.
 */
export function recentReceipts(
  budget: G.Grain,
  identities: ProcessedIdentities,
  discount: Discount
): $ReadOnlyArray<GrainReceipt> {
  const computeDecayedCred = (i) =>
    i.cred.reduce((acc, cred) => acc * (1 - discount) + cred, 0);
  const decayedCredPerIdentity = identities.map(computeDecayedCred);
  const amounts = G.splitBudget(budget, decayedCredPerIdentity);

  return identities.map(({id}, i) => ({id, amount: amounts[i]}));
}

export const recentPolicyParser: P.Parser<RecentPolicy> = P.object({
  policyType: P.exactly(["RECENT"]),
  budget: G.parser,
  discount: P.fmap(P.number, toDiscount),
});

export opaque type Discount: number = number;
export function toDiscount(n: number): Discount {
  if (n < 0 || n > 1) {
    throw new Error(`Discount must be in range [0,1]`);
  }

  return n;
}
