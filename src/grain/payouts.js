// @flow
/* global BigInt */

/**
 * This module contains "payout strategies" for distributing Grain based on scores.
 *
 * We currently have three payout strategies:
 * - fixedAmount: Given a fixed amount of Grain to distribute, split it proportional
 *   to cred scores.
 *
 * - fixedRatio: Given a target level of grainPerCred, mint Grain so that every
 *   contributors' lifetime earnings is at least grainPerCred * theirCred. Takes past
 *   earnings into account.
 *
 * - underpayment: Given a fixed amount of Grain, distribute it according to cred scores,
 *   prioritizing paying users who were "underpaid" in the past (i.e. they have a smaller
 *   proportion of lifetime earnings than is suggested by their cred score).
 */
import {sum} from "d3-array";
import * as MapUtil from "../util/map";
import {type NodeAddressT} from "../core/graph";
import {type Grain, ZERO, ONE, multiplyFloat} from "./grain";

/**
 * Distribute an amount of Grain, strictly in proportion to the scores.
 *
 * This might be a good fit for distributing a fixed grain per week directly
 * in proportion to the weekly cred score.
 */
export function fixedAmount(
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

/**
 * Distribute Grain so that each contributor's lifetime earnings
 * are at least a fixed multiple of their score.
 *
 * Parameters:
 *
 * grainPerScore: Target amount of grain for each unit of score. This is
 *   recorded as a number, and ignores grain precision (e.g. if
 *   grainPerScore===2, then we are aiming to distribute two "full" grain per
 *   unit of score, which might be tracked as 2n * 10n**18n).
 *
 * scores: The map from users' addresses to their scores. This could be
 *   lifetime cred scores, it could be this week's scores, etc.
 *
 * earnings: The map from users' addresses to their lifetime distributed payout.
 *   This information is used to determine which users have been "underpaid"
 *   relative to the payout target, and by how much.
 *
 * Since this strategy provides a consistent reward per unit cred, it means that
 * as the activity level (and thus, cred generation) in a project increases, the
 * rewards also increase. This avoids the problem with fixed-reward strategies,
 * where more participants mean less reward per person.
 *
 * If some users have been historically over-paid (e.g. because the
 * target grainPerScore was higher in the past, or a weight change decreased
 * their score), they might go for a long time without any payouts.
 *
 * Also, if users find a way to game/inflate cred scores, using this payout
 * strategy will cause grain to inflate as well.
 */
export function fixedRatio(
  grainPerScore: number,
  scores: Map<NodeAddressT, number>,
  earnings: Map<NodeAddressT, Grain>
): Map<NodeAddressT, Grain> {
  if (!isFinite(grainPerScore) || grainPerScore < 0) {
    throw new Error(`invalid grainPerScore: ${grainPerScore}`);
  }
  return MapUtil.mapValues(scores, (addr, score) => {
    const earned = earnings.get(addr) || ZERO;
    const target = multiplyFloat(ONE, grainPerScore * score);
    return target > earned ? target - earned : ZERO;
  });
}

/**
 * Distribute a fixed amount of Grain to the users who were "most underpaid".
 *
 * We consider a user underpaid if they have recieved a smaller proportion of
 * past earnings than their share of score. They are fairly paid if their
 * proportion of earnings is equal to their score share, and they are overpaid
 * if their proportion of earnings is higher than their share of the score.
 *
 * We start by imagining a hypothetical world, where the entire grain supply of
 * the project (including this harvest) were distributed according to the
 * current scores. Based on this, we can calculate the "fair" lifetime earnings
 * for each participant. Usually, some will be "underpaid" (they recieved less
 * than this amount) and others are "overpaid".
 *
 * We can sum across all users who were underpaid to find the "total
 * underpayment". As an invariant, `totalUnderpayment = harvestAmount +
 * totalOverpayment`, since no-one has yet been paid the harvestAmount, and
 * beyond that every grain of overpayment to one actor is underpayment for a
 * different actor.
 *
 * Now that we've calculated each actor's underpayment, and the total
 * underpayment, we divide the harvest's grain amount across users in
 * proportion to their underpayment.
 *
 * You should use this harvest when you want to divide a fixed amount of grain
 * across participants in a way that aligns long-term payment with total cred
 * scores.
 */
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
