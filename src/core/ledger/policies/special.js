// @flow

import {parser as uuidParser} from "../../../util/uuid";
import * as P from "../../../util/combo";
import {type IdentityId} from "../../identity";
import {type GrainReceipt} from "../grainAllocation";
import {type ProcessedIdentities} from "../processedIdentities";
import * as G from "../grain";

/**
 * The Special policy is a power-maintainer tool for directly paying Grain
 * to a target identity. I'm including it because we will use it to create
 * "initialization" payouts to contributors with prior Grain balances in our old
 * ledger.
 *
 * This has potential for abuse, I don't recommend making it easy to make special
 * payouts from the UI, since it subverts the "Grain comes from Cred" model.
 */
export type Special = "SPECIAL";

export type SpecialPolicy = {|
  +policyType: Special,
  +budget: G.Grain,
  +memo: string,
  +recipient: IdentityId,
|};

export function specialReceipts(
  policy: SpecialPolicy,
  identities: ProcessedIdentities
): $ReadOnlyArray<GrainReceipt> {
  for (const {id} of identities) {
    if (id === policy.recipient) {
      return [{id, amount: policy.budget}];
    }
  }
  throw new Error(`no active grain account for identity: ${policy.recipient}`);
}

export const specialPolicyParser: P.Parser<SpecialPolicy> = P.object({
  policyType: P.exactly(["SPECIAL"]),
  budget: G.parser,
  memo: P.string,
  recipient: uuidParser,
});
