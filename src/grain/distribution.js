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
 * - LIFETIME, which distributes a fixed budget of grain based on cred scores
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

export type DistributionStrategy = ImmediateV1 | LifetimeV1;

export type ImmediateV1 = {|
  +type: "IMMEDIATE",
  +version: number,
  +budget: Grain,
|};

export type LifetimeV1 = {|
  +type: "LIFETIME",
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
  const filteredSlices = credHistory.filter(
    (s) => s.intervalEndMs <= timestampMs
  );
  if (!filteredSlices.length) {
    return {
      type: "DISTRIBUTION",
      timestampMs,
      version: DISTRIBUTION_VERSION_1,
      strategy,
      receipts: [],
    };
  }

  const receipts: $ReadOnlyArray<GrainReceipt> = (function () {
    switch (strategy.type) {
      case "IMMEDIATE":
        if (strategy.version !== 1) {
          throw new Error(
            `Unsupported IMMEDIATE strategy: ${strategy.version}`
          );
        }
        const lastSlice = filteredSlices[filteredSlices.length - 1];
        return computeImmediateReceipts(strategy.budget, lastSlice.cred);
      case "LIFETIME":
        if (strategy.version !== 1) {
          throw new Error(`Unsupported LIFETIME strategy: ${strategy.version}`);
        }
        const totalCred = new Map();
        for (const {cred} of filteredSlices) {
          for (const [address, ownCred] of cred.entries()) {
            const existingCred = totalCred.get(address) || 0;
            totalCred.set(address, existingCred + ownCred);
          }
        }
        return computeLifetimeReceipts(strategy.budget, totalCred, earnings);
      default:
        throw new Error(`Unexpected type ${(strategy.type: empty)}`);
    }
  })();

  return {
    type: "DISTRIBUTION",
    version: DISTRIBUTION_VERSION_1,
    strategy,
    receipts,
    timestampMs,
  };
}

/**
 * Split a grain budget in proportion to the provided scores
 */
function computeImmediateReceipts(
  budget: Grain,
  cred: Map<NodeAddressT, number>
): $ReadOnlyArray<GrainReceipt> {
  if (budget < ZERO) {
    throw new Error(`invalid budget: ${String(budget)}`);
  }

  const totalCred = sum(cred.values());
  if (totalCred === 0) {
    return [];
  }

  let totalPaid = ZERO;
  const receipts = mapToArray(cred, ([address, cred]) => {
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
 * past earnings than their share of score. They are lifetimely paid if their
 * proportion of earnings is equal to their score share, and they are overpaid
 * if their proportion of earnings is higher than their share of the score.
 *
 * We start by imagining a hypothetical world, where the entire grain supply of
 * the project (including this distribution) were distributed according to the
 * current scores. Based on this, we can calculate the "lifetime" lifetime earnings
 * for each participant. Usually, some will be "underpaid" (they recieved less
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
function computeLifetimeReceipts(
  budget: Grain,
  credMap: Map<NodeAddressT, number>,
  earnings: Map<NodeAddressT, Grain>
): $ReadOnlyArray<GrainReceipt> {
  if (budget < ZERO) {
    throw new Error(`invalid budget: ${String(budget)}`);
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
