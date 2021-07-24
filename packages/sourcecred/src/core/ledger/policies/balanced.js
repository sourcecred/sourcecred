// @flow

import {sum} from "d3-array";
import * as G from "../grain";
import * as P from "../../../util/combo";
import {type GrainReceipt} from "../grainAllocation";
import {
  type NonnegativeGrain,
  grainParser,
  numberOrFloatStringParser,
} from "../nonnegativeGrain";
import {type CredGrainView} from "../../credGrainView";
import {type TimestampMs} from "../../../util/timestamp";
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

export type BalancedPolicy = {|
  +policyType: Balanced,
  +budget: NonnegativeGrain,
  +numIntervalsLookback: number,
|};

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
export function balancedReceipts(
  policy: BalancedPolicy,
  credGrainView: CredGrainView,
  effectiveTimestamp: TimestampMs
): $ReadOnlyArray<GrainReceipt> {
  if (policy.numIntervalsLookback < 0) {
    throw new Error(
      `numIntervalsLookback must be at least 0, got ${policy.numIntervalsLookback}`
    );
  }
  if (!Number.isInteger(policy.numIntervalsLookback)) {
    throw new Error(
      `numIntervalsLookback must be an integer, got ${policy.numIntervalsLookback}`
    );
  }

  const intervalsBeforeEffective = credGrainView
    .intervals()
    .filter((interval) => interval.endTimeMs <= effectiveTimestamp);

  const numIntervalsLookback = ((
    policy: BalancedPolicy,
    intervalsLength: number
  ) => {
    if (
      !policy.numIntervalsLookback ||
      policy.numIntervalsLookback > intervalsLength
    ) {
      return intervalsLength;
    } else {
      return policy.numIntervalsLookback;
    }
  })(policy, intervalsBeforeEffective.length);

  console.log("##### ---");
  console.log("##### Budget: " + policy.budget);
  console.log("##### NumIntervalsLookback: " + numIntervalsLookback);
  console.log(
    "##### IntervalsBeforeEffective: " + intervalsBeforeEffective.length
  );

  const timeLimitedcredGrainView = credGrainView.withTimeScope(
    intervalsBeforeEffective[
      intervalsBeforeEffective.length - numIntervalsLookback
    ].startTimeMs,
    effectiveTimestamp
  );

  const timeLimitedParticipants = timeLimitedcredGrainView
    .participants()
    .filter((participant) => participant.active);
  const totalCred = sum(
    timeLimitedParticipants.map((participant) => participant.cred)
  );

  console.log("##### TotalCred:" + totalCred);

  const totalEverPaid = G.sum(
    timeLimitedParticipants.map((participant) => participant.grainEarned)
  );

  console.log("##### totalEverPaid: " + totalEverPaid);
  const targetTotalDistributed = G.add(totalEverPaid, policy.budget);
  console.log("##### TargetTotalDistributed: " + targetTotalDistributed);
  const targetGrainPerCred = G.multiplyFloat(
    targetTotalDistributed,
    1 / totalCred
  );

  console.log("##### TargetGrainPerCred: " + targetGrainPerCred);

  const userUnderpayment = timeLimitedParticipants.map((participant) => {
    console.log("##### ParticipantID: " + participant.identity.id);
    console.log("##### ParticipantTotalEverPaid: " + participant.grainEarned);
    console.log("##### ParticipantTotaCred: " + participant.cred);
    const lookbackCred = sum(participant.credPerInterval);
    const target = G.multiplyFloat(targetGrainPerCred, lookbackCred);
    if (G.gt(target, participant.grainEarned)) {
      return G.sub(target, participant.grainEarned);
    } else {
      return G.ZERO;
    }
  });

  const floatUnderpayment = userUnderpayment.map((x) => Number(x));
  const grainAmounts = G.splitBudget(policy.budget, floatUnderpayment);
  console.log("##### grain amount 0: " + grainAmounts[0]);
  console.log("##### grain amount 1: " + grainAmounts[1]);
  console.log("##### ---");
  return timeLimitedParticipants.map(({identity}, i) => ({
    id: identity.id,
    amount: grainAmounts[i],
  }));
}

export const balancedConfigParser: P.Parser<BalancedPolicy> = P.object({
  policyType: P.exactly(["BALANCED"]),
  budget: numberOrFloatStringParser,
  numIntervalsLookback: P.number,
});

export const balancedPolicyParser: P.Parser<BalancedPolicy> = P.fmap(
  P.object(
    {
      policyType: P.exactly(["BALANCED"]),
      budget: grainParser,
    },
    {
      numIntervalsLookback: P.number,
    }
  ),
  (policy) => ({
    ...policy,
    numIntervalsLookback:
      policy.numIntervalsLookback != null ? policy.numIntervalsLookback : 0,
  })
);

export function toString(policy: BalancedPolicy): string {
  return [
    policy.policyType + " Policy",
    "Budget " + G.format(policy.budget, 3),
  ].join(`\n`);
}
