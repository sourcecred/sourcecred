// @flow

/**
 * In SourceCred, projects regularly distribute Grain to contributors based on
 * their Cred scores. This is called a "Distribution".
 *
 * This module contains the logic for calculating allocation amounts for
 * contributors. An allocation contains "receipts" showing how much Grain each
 * contributor will receive in a distribution, and the "strategy"
 * used to allocate grain.
 *
 * Currently we support two strategies:
 * - IMMEDIATE, which allocates a fixed budget of grain based on the cred scores
 * in the most recent completed time interval
 * - BALANCED, which allocates a fixed budget of grain based on cred scores
 * across all time, prioritizing paying people who were under-paid historically
 * (i.e. their lifetime earnings are lower than we would expect given their
 * current cred score)
 */
import {sum} from "d3-array";
import {mapToArray} from "../util/map";
import {type NodeAddressT} from "../core/graph";
import * as G from "./grain";

export const GRAIN_ALLOCATION_VERSION_1 = 1;

export type AllocationStrategy = ImmediateV1 | BalancedV1;

export type ImmediateV1 = {|
  +type: "IMMEDIATE",
  +version: number,
|};

export type BalancedV1 = {|
  +type: "BALANCED",
  +version: number,
|};

export type GrainReceipt = {|
  +address: NodeAddressT,
  +amount: G.Grain,
|};

export type GrainAllocationV1 = {|
  +version: number,
  +strategy: AllocationStrategy,
  +budget: G.Grain,
  +receipts: $ReadOnlyArray<GrainReceipt>,
|};

export type CredTimeSlice = {|
  +intervalEndMs: number,
  +cred: Map<NodeAddressT, number>,
|};

export type CredHistory = $ReadOnlyArray<CredTimeSlice>;

/**
 * Compute a full Allocation given:
 * - the strategy we're using
 * - the amount of Grain to allocate
 * - the full cred history for all users
 * - a Map of the total lifetime grain that
 *   has been distributed to each user
 */
export function createGrainAllocation(
  strategy: AllocationStrategy,
  budget: G.Grain,
  credHistory: CredHistory,
  lifetimeGrainAllocation: Map<NodeAddressT, G.Grain>
): GrainAllocationV1 {
  if (G.lt(budget, G.ZERO)) {
    throw new Error(`invalid budget: ${String(budget)}`);
  }

  const computeReceipts = (): $ReadOnlyArray<GrainReceipt> => {
    switch (strategy.type) {
      case "IMMEDIATE":
        return computeImmediateReceipts(strategy, budget, credHistory);
      case "BALANCED":
        return computeBalancedReceipts(
          strategy,
          budget,
          credHistory,
          lifetimeGrainAllocation
        );
      default:
        throw new Error(`Unexpected type ${strategy.type}`);
    }
  };

  return {
    version: GRAIN_ALLOCATION_VERSION_1,
    strategy,
    budget,
    receipts: computeReceipts(),
  };
}

/**
 * Split a grain budget in proportion to the cred scores in
 * the most recent time interval
 */
function computeImmediateReceipts(
  {version}: ImmediateV1,
  budget: G.Grain,
  credHistory: CredHistory
): $ReadOnlyArray<GrainReceipt> {
  if (version !== 1) {
    throw new Error(`Unsupported IMMEDIATE version: ${version}`);
  }

  if (budget <= G.ZERO || !credHistory.length) {
    return [];
  }

  const lastSlice = credHistory[credHistory.length - 1];

  const immediateCredMap = lastSlice.cred;

  const totalCred = sum(immediateCredMap.values());
  if (totalCred === 0) {
    return [];
  }

  let totalPaid = G.ZERO;
  const receipts = mapToArray(immediateCredMap, ([address, cred]) => {
    const amount = G.multiplyFloat(budget, cred / totalCred);
    totalPaid = G.add(totalPaid, amount);
    return {
      address,
      amount,
    };
  });
  if (G.gt(totalPaid, budget)) {
    throw new Error(
      `invariant violation: paid ${totalPaid} greater than budget ${budget}`
    );
  }
  return receipts;
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
  {version}: BalancedV1,
  budget: G.Grain,
  credHistory: CredHistory,
  lifetimeGrainAllocation: Map<NodeAddressT, G.Grain>
): $ReadOnlyArray<GrainReceipt> {
  if (version !== 1) {
    throw new Error(`Unsupported BALANCED version: ${version}`);
  }

  if (budget <= G.ZERO || !credHistory.length) {
    return [];
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
    return [];
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

  let totalPaid = G.ZERO;
  const receipts = mapToArray(userUnderpayment, ([address, underpayment]) => {
    const underpaymentProportion = G.toFloatRatio(
      underpayment,
      totalUnderpayment
    );
    const amount = G.multiplyFloat(budget, underpaymentProportion);
    totalPaid = G.add(totalPaid, amount);
    return {
      address,
      amount,
    };
  });
  if (G.gt(totalPaid, budget)) {
    throw new Error(
      `invariant violation: paid ${totalPaid} greater than budget ${budget}`
    );
  }
  return receipts;
}
