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
|};

/**
 * Split a grain budget in proportion to the cred scores in
 * the most recent time interval.
 */
export function immediateReceipts(
  budget: G.Grain,
  identities: ProcessedIdentities
): $ReadOnlyArray<GrainReceipt> {
  const amounts = G.splitBudget(
    budget,
    identities.map((i) => i.mostRecentCred)
  );
  return identities.map(({id}, i) => ({id, amount: amounts[i]}));
}

export const immediatePolicyParser: P.Parser<ImmediatePolicy> = P.object({
  policyType: P.exactly(["IMMEDIATE"]),
  budget: G.parser,
});
