// @flow

/**
 * In SourceCred, projects regularly distribute Grain to contributors based on
 * their Cred scores. This is called a "Distribution". This module contains the
 * logic for computing distributions.
 */
import {sum} from "d3-array";
import * as G from "./grain";
import * as P from "../../util/combo";
import {
  type Uuid,
  random as randomUuid,
  parser as uuidParser,
} from "../../util/uuid";
import {type IdentityId} from "../identity";

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

/**
 * The Immediate policy evenly distributes its Grain budget
 * across users based on their Cred in the most recent interval.
 *
 * It's used when you want to ensure that everyone gets some consistent reward
 * for participating (even if they may be "overpaid" in a lifetime sense).
 * We recommend using a smaller budget for the Immediate policy.
 */
export type Immediate = "IMMEDIATE";

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

export type AllocationPolicy = BalancedPolicy | ImmediatePolicy | SpecialPolicy;

export type BalancedPolicy = {|
  +policyType: Balanced,
  +budget: G.Grain,
|};

export type ImmediatePolicy = {|
  +policyType: Immediate,
  +budget: G.Grain,
|};

export type SpecialPolicy = {|
  +policyType: Special,
  +budget: G.Grain,
  +memo: string,
  +recipient: IdentityId,
|};

export type GrainReceipt = {|
  +id: IdentityId,
  +amount: G.Grain,
|};

export type Allocation = {|
  +id: Uuid,
  +policy: AllocationPolicy,
  +receipts: $ReadOnlyArray<GrainReceipt>,
|};

export type AllocationIdentity = {|
  +cred: $ReadOnlyArray<number>,
  +paid: G.Grain,
  +id: IdentityId,
|};

export function computeAllocation(
  policy: AllocationPolicy,
  identities: $ReadOnlyArray<AllocationIdentity>
): Allocation {
  const validatedPolicy = _validatePolicy(policy);
  const processedIdentities = _processIdentities(identities);
  return _validateAllocationBudget({
    policy,
    receipts: receipts(validatedPolicy, processedIdentities),
    id: randomUuid(),
  });
}

// ProcessedIdentities type has the following guarantees:
// - no Cred is negative
// - no Paid is negative
// - total Cred is positive
// - all cred arrays have same length
opaque type ProcessedIdentities = $ReadOnlyArray<{|
  +paid: G.Grain,
  +id: IdentityId,
  +cred: $ReadOnlyArray<number>,
  +lifetimeCred: number,
  +mostRecentCred: number,
|}>;
function _processIdentities(
  items: $ReadOnlyArray<AllocationIdentity>
): ProcessedIdentities {
  if (items.length === 0) {
    throw new Error(`must have at least one identity to allocate grain to`);
  }
  let hasPositiveCred = false;
  const credLength = items[0].cred.length;
  const results = items.map((i) => {
    const {cred, id, paid} = i;
    if (G.lt(paid, G.ZERO)) {
      throw new Error(`negative paid: ${paid}`);
    }
    if (credLength !== cred.length) {
      throw new Error(
        `inconsistent cred length: ${credLength} vs ${cred.length}`
      );
    }
    let lifetimeCred = 0;
    for (const c of cred) {
      if (c < 0 || !isFinite(c)) {
        throw new Error(`invalid cred: ${c}`);
      }
      if (c > 0) {
        hasPositiveCred = true;
      }
      lifetimeCred += c;
    }
    return {
      id,
      paid,
      cred,
      lifetimeCred,
      mostRecentCred: cred[cred.length - 1],
    };
  });
  if (!hasPositiveCred) {
    throw new Error("cred is zero");
  }
  return results;
}

function _validatePolicy(p: AllocationPolicy) {
  allocationPolicyParser.parseOrThrow(p);
  if (G.lt(p.budget, G.ZERO)) {
    throw new Error(`invalid budget: ${p.budget}`);
  }
  return p;
}

// Exported for test purposes.
export function _validateAllocationBudget(a: Allocation): Allocation {
  const amt = G.sum(a.receipts.map((a) => a.amount));
  if (amt !== a.policy.budget) {
    throw new Error(
      `allocation has budget of ${a.policy.budget} but distributed ${amt}`
    );
  }
  return a;
}

function receipts(
  policy: AllocationPolicy,
  identities: ProcessedIdentities
): $ReadOnlyArray<GrainReceipt> {
  switch (policy.policyType) {
    case "IMMEDIATE":
      return immediateReceipts(policy.budget, identities);
    case "BALANCED":
      return balancedReceipts(policy.budget, identities);
    case "SPECIAL":
      return specialReceipts(policy, identities);
    // istanbul ignore next: unreachable per Flow
    default:
      throw new Error(`Unknown policyType: ${(policy.policyType: empty)}`);
  }
}

/**
 * Split a grain budget in proportion to the cred scores in
 * the most recent time interval
 */
function immediateReceipts(
  budget: G.Grain,
  identities: ProcessedIdentities
): $ReadOnlyArray<GrainReceipt> {
  const amounts = G.splitBudget(
    budget,
    identities.map((i) => i.mostRecentCred)
  );
  return identities.map(({id}, i) => ({id, amount: amounts[i]}));
}

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
function balancedReceipts(
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

function specialReceipts(
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

const balancedPolicyParser: P.Parser<BalancedPolicy> = P.object({
  policyType: P.exactly(["BALANCED"]),
  budget: G.parser,
});

const immediatePolicyParser: P.Parser<ImmediatePolicy> = P.object({
  policyType: P.exactly(["IMMEDIATE"]),
  budget: G.parser,
});

const specialPolicyParser: P.Parser<SpecialPolicy> = P.object({
  policyType: P.exactly(["SPECIAL"]),
  budget: G.parser,
  memo: P.string,
  recipient: uuidParser,
});

export const allocationPolicyParser: P.Parser<AllocationPolicy> = P.orElse([
  balancedPolicyParser,
  immediatePolicyParser,
  specialPolicyParser,
]);

const grainReceiptParser: P.Parser<GrainReceipt> = P.object({
  id: uuidParser,
  amount: G.parser,
});
export const allocationParser: P.Parser<Allocation> = P.object({
  policy: allocationPolicyParser,
  id: uuidParser,
  receipts: P.array(grainReceiptParser),
});
