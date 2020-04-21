// @flow

/**
 * In SourceCred, projects regularly distribute Grain to contributors based on
 * their Cred scores. This is called a "Distribution".
 *
 * This module contains the logic for calculating distribution amounts for
 * contributors. A distribution contains "receipts" showing how much Grain each
 * contributor will receive, the timestamp of the distribution in question, and the
 * "strategy" used to distribute grain.
 *
 * Currently we support two strategies:
 * - IMMEDIATE, which distributes a fixed budget of grain based on the cred scores
 * in the most recent completed time interval
 * - BALANCED, which distributes a fixed budget of grain based on cred scores
 * across
 * all time, prioritizing paying people who were under-paid historically (i.e.
 * their lifetime earnings are lower than we would expect given their current
 * cred score)
 *
 * In all cases, the timestamp for the distribution is used to determine which cred
 * scores are in scope. For example, if you create a immediate distribution with a
 * timestamp in the past, it will reward people with cred in the past time
 * period, not the current one.
 */
import {sum} from "d3-array";
import {mapToArray} from "../util/map";
import {type NodeAddressT} from "../core/graph";
import {
  type Grain,
  multiplyFloat,
  ZERO,
  toFloatRatio,
  format,
  DECIMAL_PRECISION,
} from "./grain";

export const DISTRIBUTION_VERSION_1 = 1;

export type DistributionStrategy = ImmediateV1 | BalancedV1;

export type ImmediateV1 = {|
  +type: "IMMEDIATE",
  +version: number,
  +budget: Grain,
|};

export type BalancedV1 = {|
  +type: "BALANCED",
  +version: number,
  +budget: Grain,
|};

export type GrainReceipt = {|
  +address: NodeAddressT,
  +amount: Grain,
|};

export type DistributionV1 = {|
  +type: "DISTRIBUTION",
  +timestampMs: number,
  +version: number,
  +strategy: DistributionStrategy,
  +receipts: $ReadOnlyArray<GrainReceipt>,
|};

export type CredTimeSlice = {|
  +intervalEndMs: number,
  +cred: Map<NodeAddressT, number>,
|};

export type CredHistory = $ReadOnlyArray<CredTimeSlice>;

/**
 * Compute a full Distribution given:
 * - the strategy we're using
 * - the full cred history for all users
 * - the lifetime earnings of all users
 * - the timestamp for the distribution
 */
export function distribution(
  strategy: DistributionStrategy,
  credHistory: CredHistory,
  earnings: Map<NodeAddressT, Grain>,
  timestampMs: number
): DistributionV1 {
  const timeFilteredCredHistory = credHistory.filter(
    (s) => s.intervalEndMs <= timestampMs
  );

  const computeReceipts = (): $ReadOnlyArray<GrainReceipt> => {
    switch (strategy.type) {
      case "IMMEDIATE":
        return computeImmediateReceipts(strategy, timeFilteredCredHistory);
      case "BALANCED":
        return computeBalancedReceipts(
          strategy,
          timeFilteredCredHistory,
          earnings
        );
      default:
        throw new Error(`Unexpected type ${strategy.type}`);
    }
  };

  return {
    type: "DISTRIBUTION",
    version: DISTRIBUTION_VERSION_1,
    strategy,
    receipts: computeReceipts(),
    timestampMs,
  };
}

/**
 * Split a grain budget in proportion to the cred scores in
 * the most recent time interval
 */
function computeImmediateReceipts(
  {budget, version}: ImmediateV1,
  credHistory: CredHistory
): $ReadOnlyArray<GrainReceipt> {
  if (version !== 1) {
    throw new Error(`Unsupported IMMEDIATE strategy: ${version}`);
  }

  if (budget < ZERO) {
    throw new Error(`invalid budget: ${String(budget)}`);
  }

  if (!credHistory.length) {
    return [];
  }

  const lastSlice = credHistory[credHistory.length - 1];

  const credMap = lastSlice.cred;

  const totalCred = sum(credMap.values());
  if (totalCred === 0) {
    return [];
  }

  let totalPaid = ZERO;
  const receipts = mapToArray(credMap, ([address, cred]) => {
    const amount = multiplyFloat(budget, cred / totalCred);
    totalPaid += amount;
    return {
      address,
      amount,
    };
  });
  if (totalPaid > budget) {
    console.warn(
      `Warning: had budget of ${format(
        budget,
        DECIMAL_PRECISION
      )} but paying out ${format(totalPaid, DECIMAL_PRECISION)}`
    );
  }
  return receipts;
}

/**
 * Distribute a fixed budget of Grain to the users who were "most underpaid".
 *
 * We consider a user underpaid if they have recieved a smaller proportion of
 * past earnings than their share of score. They are balanced paid if their
 * proportion of earnings is equal to their score share, and they are overpaid
 * if their proportion of earnings is higher than their share of the score.
 *
 * We start by imagining a hypothetical world, where the entire grain supply of
 * the project (including this distribution) were distributed according to the
 * current scores. Based on this, we can calculate the "balanced" lifetime earnings
 * for each participant. Usually, some will be "underpaid" (they received less
 * than this amount) and others are "overpaid".
 *
 * We can sum across all users who were underpaid to find the "total
 * underpayment".
 *
 * Now that we've calculated each actor's underpayment, and the total
 * underpayment, we divide the distribution's grain budget across users in
 * proportion to their underpayment.
 *
 * You should use this distribution when you want to divide a fixed budget of grain
 * across participants in a way that aligns long-term payment with total cred
 * scores.
 */
function computeBalancedReceipts(
  {budget, version}: BalancedV1,
  credHistory: CredHistory,
  earnings: Map<NodeAddressT, Grain>
): $ReadOnlyArray<GrainReceipt> {
  if (version !== 1) {
    throw new Error(`Unsupported BALANCED strategy: ${version}`);
  }

  if (budget < ZERO) {
    throw new Error(`invalid budget: ${String(budget)}`);
  }

  if (!credHistory.length) {
    return [];
  }

  const credMap = new Map();
  for (const {cred} of credHistory) {
    for (const [address, ownCred] of cred.entries()) {
      const existingCred = credMap.get(address) || 0;
      credMap.set(address, existingCred + ownCred);
    }
  }

  let totalEarnings = ZERO;
  for (const e of earnings.values()) {
    totalEarnings += e;
  }
  let totalCred = 0;
  for (const s of credMap.values()) {
    totalCred += s;
  }
  if (totalCred === 0) {
    return [];
  }

  const targetGrainPerCred = multiplyFloat(
    totalEarnings + budget,
    1 / totalCred
  );

  let totalUnderpayment = ZERO;
  const userUnderpayment: Map<NodeAddressT, Grain> = new Map();
  const addresses = new Set([...credMap.keys(), ...earnings.keys()]);

  for (const addr of addresses) {
    const earned = earnings.get(addr) || ZERO;
    const cred = credMap.get(addr) || 0;

    const target = multiplyFloat(targetGrainPerCred, cred);
    if (target > earned) {
      const underpayment = target - earned;
      userUnderpayment.set(addr, underpayment);
      totalUnderpayment += underpayment;
    }
  }

  let totalPaid = ZERO;
  const receipts = mapToArray(userUnderpayment, ([address, underpayment]) => {
    const underpaymentProportion = toFloatRatio(
      underpayment,
      totalUnderpayment
    );
    const amount = multiplyFloat(budget, underpaymentProportion);
    totalPaid += amount;
    return {
      address,
      amount,
    };
  });
  if (totalPaid > budget) {
    console.warn(
      `Warning: had budget of ${format(
        budget,
        DECIMAL_PRECISION
      )} but paying out ${format(totalPaid, DECIMAL_PRECISION)}`
    );
  }
  return receipts;
}
