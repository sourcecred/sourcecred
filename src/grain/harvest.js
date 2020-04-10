// @flow

import {sum} from "d3-array";
import * as MapUtil from "../util/map";
import {type NodeAddressT} from "../core/graph";
import {type Grain, ZERO, ONE, multiplyFloat} from "./grain";

export type HarvestStrategy = Fast_v1 | Fair_v1;

export type Fast_v1 = {|
  +type: "FAST",
  +version: number,
  +amount: Grain,
|};

export type Fair_v1 = {|
  +type: "FAIR",
  +version: number,
  +amount: Grain,
|};

export type Harvest_v1 = {|
  +type: "HARVEST",
  +timestampMs: number,
  +version: number,
  +strategy: HarvestStrategy,
  +receipts: $ReadOnlyArray<{|+address: NodeAddressT, amount: Grain|}>,
|};

export type CredTimeSlice = {|
  +intervalEndMs: number,
  +scores: Map<NodeAddressT, number>,
|};
export type CredScores = $ReadOnlyArray<CredTimeSlice>;

export function harvest(
  strategy: HarvestStrategy,
  credScores: CredScores,
  earnings: Map<NodeAddressT, Grain>,
  timestampMs: number
): Harvest_v1 {
  const filteredSlices = credScores.filter(
    (s) => s.intervalEndMs <= timestampMs
  );
  if (!filteredSlices.length) {
    throw new Error("Need some cred scores in time range to compute harvest");
  }
  const payoutMap: Map<NodeAddressT, Grain> = (function () {
    switch (strategy.type) {
      case "FAST":
        if (strategy.version !== 1) {
          throw new Error(`Unsupported FAST strategy: ${strategy.version}`);
        }
        const lastSlice = filteredSlices[filteredSlices.length - 1];
        return fixedAmount(strategy.amount, lastSlice.scores);
      case "FAIR":
        if (strategy.version !== 1) {
          throw new Error(`Unsupported FAIR strategy: ${strategy.version}`);
        }
        const totalScores = new Map();
        for (const {scores} of filteredSlices) {
          for (const [address, score] of scores.entries()) {
            const existingScore = totalScores.get(address) || 0;
            totalScores.set(address, existingScore + score);
          }
        }
        return underpayment(strategy.amount, totalScores, earnings);
      default:
        throw new Error(`Unexpected type ${(strategy.type: empty)}`);
    }
  })();
  const receipts = Array.from(payoutMap.entries()).map(([address, amount]) => ({
    address,
    amount,
  }));
  return {type: "HARVEST", version: 1, strategy, receipts, timestampMs};
}

function fixedAmount(
  harvestAmount: Grain,
  scores: Map<NodeAddressT, number>
): Map<NodeAddressT, Grain> {
  if (harvestAmount < ZERO) {
    throw new Error(`invalid harvestAmount: ${String(harvestAmount)}`);
  }
  if (scores.size === 0) {
    return new Map();
  }
  const totalScore = sum(Array.from(scores.values()));
  if (totalScore === 0) {
    const perCapita = multiplyFloat(harvestAmount, 1 / scores.size);
    return MapUtil.mapValues(scores, () => perCapita);
  }
  const computeShare = (_, score) =>
    multiplyFloat(harvestAmount, score / totalScore);
  return MapUtil.mapValues(scores, computeShare);
}

export function underpayment(
  harvestAmount: Grain,
  scores: Map<NodeAddressT, number>,
  earnings: Map<NodeAddressT, Grain>
): Map<NodeAddressT, Grain> {
  let totalEarnings = ZERO;
  for (const e of earnings.values()) {
    totalEarnings += e;
  }
  let totalScore = 0;
  for (const s of scores.values()) {
    totalScore += s;
  }
  if (totalScore === 0) {
    return fixedAmount(harvestAmount, scores);
  }
  const targetGrainPerScore =
    Number(totalEarnings + harvestAmount) / totalScore;
  let totalUnderpayment = ZERO;
  let totalOverpayment = ZERO;
  let userUnderpayment: Map<NodeAddressT, Grain> = new Map();
  const addresses = new Set([...scores.keys(), ...earnings.keys()]);
  for (const addr of addresses) {
    const earned = earnings.get(addr) || ZERO;
    const score = scores.get(addr) || 0;
    // $ExpectFlowError
    const target = BigInt(Math.floor(targetGrainPerScore * score));
    if (target > earned) {
      totalUnderpayment += target - earned;
      userUnderpayment.set(addr, target - earned);
    } else {
      totalOverpayment += earned - target;
    }
  }
  // invariant check
  //
  if (totalOverpayment + harvestAmount !== totalUnderpayment) {
    console.error(totalOverpayment, harvestAmount, totalUnderpayment);
  }
  const results = new Map();
  for (const [addr, underpayment] of userUnderpayment) {
    const underpaymentProportion =
      Number(underpayment) / Number(totalUnderpayment);
    results.set(addr, multiplyFloat(harvestAmount, underpaymentProportion));
  }
  return results;
}
