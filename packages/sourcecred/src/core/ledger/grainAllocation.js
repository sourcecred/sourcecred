// @flow

/**
 * In SourceCred, projects regularly distribute Grain to contributors based on
 * their Cred scores. This is called a "Distribution". This module contains the
 * logic for computing distributions.
 */
import * as G from "./grain";
import * as P from "../../util/combo";
import {
  type Uuid,
  random as randomUuid,
  parser as uuidParser,
} from "../../util/uuid";
import {type IdentityId} from "../identity";
import {
  type AllocationPolicy,
  allocationPolicyParser,
  balancedReceipts,
  immediateReceipts,
  recentReceipts,
  specialReceipts,
} from "./policies";
import {
  type ProcessedIdentities,
  processIdentities,
} from "./processedIdentities";

export type AllocationId = Uuid;

export type GrainReceipt = {|
  +id: IdentityId,
  +amount: G.Grain,
|};

export type Allocation = {|
  +id: AllocationId,
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
  const processedIdentities = processIdentities(identities);
  return _validateAllocationBudget({
    policy,
    receipts: receipts(validatedPolicy, processedIdentities),
    id: randomUuid(),
  });
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
      return immediateReceipts(policy, identities);
    case "RECENT":
      return recentReceipts(policy.budget, identities, policy.discount);
    case "BALANCED":
      return balancedReceipts(policy.budget, identities);
    case "SPECIAL":
      return specialReceipts(policy, identities);
    // istanbul ignore next: unreachable per Flow
    default:
      throw new Error(`Unknown policyType: ${(policy.policyType: empty)}`);
  }
}

const grainReceiptParser: P.Parser<GrainReceipt> = P.object({
  id: uuidParser,
  amount: G.parser,
});
export const allocationParser: P.Parser<Allocation> = P.object({
  policy: allocationPolicyParser,
  id: uuidParser,
  receipts: P.array(grainReceiptParser),
}); 
