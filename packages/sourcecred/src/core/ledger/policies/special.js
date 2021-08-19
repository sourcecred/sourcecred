// @flow

import {parser as uuidParser} from "../../../util/uuid";
import * as P from "../../../util/combo";
import type {IdentityId} from "../../identity";
import * as G from "../grain";
import type {GrainReceipt} from "../grainAllocation";
import type {CredGrainView} from "../../../core/credGrainView";
import {
  type NonnegativeGrain,
  grainParser,
  numberOrFloatStringParser,
} from "../nonnegativeGrain";

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
  +budget: NonnegativeGrain,
  +memo: string,
  +recipient: IdentityId,
  +ignoreActiveStatus?: boolean,
|};

export function specialReceipts(
  policy: SpecialPolicy,
  credGrainView: CredGrainView
): $ReadOnlyArray<GrainReceipt> {
  const identities = policy.ignoreActiveStatus
    ? credGrainView.participants()
    : credGrainView.activeParticipants();
  for (const {identity} of identities) {
    if (identity.id === policy.recipient) {
      return [{id: identity.id, amount: policy.budget}];
    }
  }
  throw new Error(
    `no ${
      policy.ignoreActiveStatus ? "" : "active "
    }grain account for identity: ${policy.recipient}`
  );
}

export const specialConfigParser: P.Parser<SpecialPolicy> = P.object(
  {
    policyType: P.exactly(["SPECIAL"]),
    budget: numberOrFloatStringParser,
    memo: P.string,
    recipient: uuidParser,
  },
  {
    ignoreActiveStatus: P.boolean,
  }
);

export const specialPolicyParser: P.Parser<SpecialPolicy> = P.object(
  {
    policyType: P.exactly(["SPECIAL"]),
    budget: grainParser,
    memo: P.string,
    recipient: uuidParser,
  },
  {
    ignoreActiveStatus: P.boolean,
  }
);

export function toString(policy: SpecialPolicy): string {
  return [
    policy.policyType + " Policy",
    "Budget " + G.format(policy.budget, 3),
    "Memo: " + policy.memo,
    "Recepient: " + policy.recipient,
    "IgnoreActiveStatus: " + (policy.ignoreActiveStatus?.toString() || "false"),
  ].join(`\n`);
}
