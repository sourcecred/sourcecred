// @flow

/**
 * In SourceCred, projects regularly distribute Grain to contributors based on
 * their Cred scores. This is called a "Distribution". This module contains the
 * logic for computing distributions.
 */
import {sum} from "d3-array";
import {mapToArray} from "../util/map";
import {type NodeAddressT, NodeAddress} from "../core/graph";
import * as G from "./grain";
import * as P from "../util/combo";
import {type TimestampMs} from "../util/timestamp";

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
export type PolicyType = Immediate | Balanced;

export type AllocationPolicy = {|
  +policyType: PolicyType,
  +budget: G.Grain,
|};

export type Distribution = {|
  +allocations: $ReadOnlyArray<Allocation>,
  // The Timestamp of the latest Cred interval used when computing this distribution.
  +credTimestamp: TimestampMs,
|};

export type GrainReceipt = {|
  +address: NodeAddressT,
  +amount: G.Grain,
|};

export type Allocation = {|
  +policy: AllocationPolicy,
  +receipts: $ReadOnlyArray<GrainReceipt>,
|};

export type CredTimeSlice = {|
  +intervalEndMs: number,
  +cred: $ReadOnlyMap<NodeAddressT, number>,
|};
export type CredHistory = $ReadOnlyArray<CredTimeSlice>;

export function computeDistribution(
  policies: $ReadOnlyArray<AllocationPolicy>,
  credHistory: CredHistory,
  lifetimePaid: $ReadOnlyMap<NodeAddressT, G.Grain>
): Distribution {
  if (credHistory.length === 0) {
    throw new Error(`cannot distribute with empty credHistory`);
  }
  const credTimestamp = credHistory[credHistory.length - 1].intervalEndMs;
  if (!isFinite(credTimestamp)) {
    throw new Error(`invalid credTimestamp: ${credTimestamp}`);
  }
  const allocations = policies.map((p) =>
    computeAllocation(p, credHistory, lifetimePaid)
  );
  return {credTimestamp, allocations};
}

export function computeAllocation(
  policy: AllocationPolicy,
  credHistory: CredHistory,
  // A map from each address to the total amount of Grain already paid
  // to that Address, across time.
  lifetimePaid: $ReadOnlyMap<NodeAddressT, G.Grain>
): Allocation {
  const {budget, policyType} = policy;
  if (G.lt(budget, G.ZERO)) {
    throw new Error(`invalid budget: ${String(budget)}`);
  }

  const computeReceipts = (): $ReadOnlyArray<GrainReceipt> => {
    switch (policyType) {
      case "IMMEDIATE":
        return computeImmediateReceipts(budget, credHistory);
      case "BALANCED":
        return computeBalancedReceipts(budget, credHistory, lifetimePaid);
      // istanbul ignore next: unreachable per Flow
      default:
        throw new Error(`Unexpected type ${(policyType: empty)}`);
    }
  };

  return {
    policy,
    receipts: computeReceipts(),
  };
}

/**
 * Split a grain budget in proportion to the cred scores in
 * the most recent time interval
 */
function computeImmediateReceipts(
  budget: G.Grain,
  credHistory: CredHistory
): $ReadOnlyArray<GrainReceipt> {
  if (budget === G.ZERO) {
    return [];
  }

  if (!credHistory.length) {
    throw new Error("cannot allocate Grain: credHistory is empty");
  }

  const lastSlice = credHistory[credHistory.length - 1];

  const immediateCredMap = lastSlice.cred;

  const totalCred = sum(immediateCredMap.values());
  if (totalCred === 0) {
    throw new Error("cannot allocate Grain: cred sums to 0");
  }

  const scores: number[] = mapToArray(immediateCredMap, (x) => x[1]);
  const grainPieces = G.splitBudget(budget, scores);
  return mapToArray(immediateCredMap, (x, i) => ({
    address: x[0],
    amount: grainPieces[i],
  }));
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
function computeBalancedReceipts(
  budget: G.Grain,
  credHistory: CredHistory,
  lifetimeGrainAllocation: $ReadOnlyMap<NodeAddressT, G.Grain>
): $ReadOnlyArray<GrainReceipt> {
  if (budget === G.ZERO) {
    return [];
  }
  if (!credHistory.length) {
    throw new Error("cannot allocate Grain: credHistory is empty");
  }

  const lifetimeCredMap = new Map();
  for (const {cred} of credHistory) {
    for (const [address, ownCred] of cred.entries()) {
      const existingCred = lifetimeCredMap.get(address) || 0;
      lifetimeCredMap.set(address, existingCred + ownCred);
    }
  }

  let totalEarnings = G.ZERO;
  for (const e of lifetimeGrainAllocation.values()) {
    totalEarnings = G.add(totalEarnings, e);
  }
  let totalCred = 0;
  for (const s of lifetimeCredMap.values()) {
    totalCred += s;
  }
  if (totalCred === 0) {
    throw new Error("cannot allocate Grain: cred sums to 0");
  }

  const targetGrainPerCred = G.multiplyFloat(
    G.add(totalEarnings, budget),
    1 / totalCred
  );

  let totalUnderpayment = G.ZERO;
  const userUnderpayment: Map<NodeAddressT, G.Grain> = new Map();
  const addresses = new Set([
    ...lifetimeCredMap.keys(),
    ...lifetimeGrainAllocation.keys(),
  ]);

  for (const addr of addresses) {
    const earned = lifetimeGrainAllocation.get(addr) || G.ZERO;
    const cred = lifetimeCredMap.get(addr) || 0;

    const target = G.multiplyFloat(targetGrainPerCred, cred);
    if (G.gt(target, earned)) {
      const underpayment = G.sub(target, earned);
      userUnderpayment.set(addr, underpayment);
      totalUnderpayment = G.add(totalUnderpayment, underpayment);
    }
  }

  const underpayment = mapToArray(userUnderpayment, (x) => Number(x[1]));
  const grainPieces = G.splitBudget(budget, underpayment);
  return mapToArray(userUnderpayment, (x, i) => ({
    address: x[0],
    amount: grainPieces[i],
  }));
}

export const allocationPolicyParser: P.Parser<AllocationPolicy> = P.object({
  policyType: P.exactly(["IMMEDIATE", "BALANCED"]),
  budget: G.parser,
});
const grainReceiptParser: P.Parser<GrainReceipt> = P.object({
  address: NodeAddress.parser,
  amount: G.parser,
});
export const allocationParser: P.Parser<Allocation> = P.object({
  policy: allocationPolicyParser,
  receipts: P.array(grainReceiptParser),
});
export const distributionParser: P.Parser<Distribution> = P.object({
  allocations: P.array(allocationParser),
  credTimestamp: P.number,
});
