// @flow

/**
 * This module adds a system for specifying "bonus minting" policies. The core
 * idea for bonus minting is that extra Cred is conjured out of thin air (as a
 * "bonus") and distributed to a chosen recipient. This system is intended to
 * be used for minting Cred for project-level dependencies. For example, we
 * would like users of SourceCred to mint some extra Cred and flow it to the
 * SourceCred project.
 *
 * In CredRank, we handle this by creating extra nodes in the graph which mint
 * the bonus Cred, and it flows directly from those nodes to the intended
 * recipients.
 *
 * The total amount of Cred that may be minted is unbounded; for example, if
 * the dependencies have a total weight of 0.2, then the total Cred will be
 * 120% of the base Cred, but if the dependencies had a total weight of 1, then
 * the total Cred would be double the base Cred. This was a deliberate design
 * decision so that dependency minting would feel "non-rival", i.e. there is
 * not a fixed budget of dependency cred that must be split between the
 * dependencies. In some cases, it may be reasonable for the total Cred flowing
 * to a project's dependencies to be larger than the total Cred flowing
 * directly to the project's contributors; consider that the total amount of
 * time/effort invested in building all the dependencies may be orders of
 * magnitude larger than investment in the project itself.
 */
import {type NodeAddressT, NodeAddress} from "./graph";
import {type TimestampMs} from "../util/timestamp";
import {type IntervalSequence} from "./interval";

export type BonusPolicy = {|
  // The node address that will receieve the extra minted Cred
  +address: NodeAddressT,
  // Information on how the Cred minting weight varies in time.
  +periods: $ReadOnlyArray<BonusPeriod>,
|};

export type BonusPeriod = {|
  // What proportion of the project's raw Cred should be minted to this
  // dependency during this period. For example, if the weight is 0.05, and the
  // project has a pre-dependencies total Cred of 1000 in a given interval,
  // then this dependency will receive an additional 50 Cred.
  +weight: number,
  // Timestamp or number because we allow -Infinity as the first "timestamp"
  // Within any policy, the period timestamps must be in sorted order, or else
  // an error will be thrown.
  +startTimeMs: TimestampMs | number,
|};

// ========================= DEPRECATED =========================
// Everything below this line has TimelineCred specific logic, and will be
// removed when we switch to CredRank.

/**
 * The ProcessedBonusPolicy is a BonusPolicy which has
 * been transformed so that it matches the abstractions available when
 * we're doing raw cred computation: instead of an address, we track an index
 * into the canonical node order, and rather than arbitrary client-provided
 * periods, we compute the weight for each Interval.
 */
export type ProcessedBonusPolicy = {|
  +nodeIndex: number,
  +intervalWeights: $ReadOnlyArray<number>,
|};

export function processBonusPolicy(
  policy: BonusPolicy,
  nodeOrder: $ReadOnlyArray<NodeAddressT>,
  intervals: IntervalSequence
): ProcessedBonusPolicy {
  const {address, periods} = policy;
  const nodeIndex = nodeOrder.indexOf(address);
  if (nodeIndex === -1) {
    throw new Error(
      `address not in nodeOrder: ${NodeAddress.toString(address)}`
    );
  }
  const intervalStarts = intervals.map((i) => i.startTimeMs);
  const intervalWeights = _alignPeriodsToIntervals(periods, intervalStarts);
  return {nodeIndex, intervalWeights};
}

export function _alignPeriodsToIntervals(
  periods: $ReadOnlyArray<BonusPeriod>,
  intervalStarts: $ReadOnlyArray<TimestampMs>
): $ReadOnlyArray<number> {
  if (periods.length === 0) {
    return intervalStarts.map(() => 0);
  }
  // Validate the periods to make sure they are in order and the weights
  // are finite and non-negative
  let currentStartTimeMs = periods[0].startTimeMs;
  for (const {startTimeMs, weight} of periods) {
    if (currentStartTimeMs > startTimeMs) {
      throw new Error(
        `mint periods out of order: ${currentStartTimeMs} > ${startTimeMs}`
      );
    }
    currentStartTimeMs = startTimeMs;
    if (weight < 0 || !Number.isFinite(weight)) {
      throw new Error(`invalid mint weight: ${weight}`);
    }
  }
  let currentPeriodIndex = -1;
  let currentWeight = 0;
  // We always return the weight of the latest period whose startTimeMs was
  // less than or equal to the interval's start.
  return intervalStarts.map((s) => {
    while (
      currentPeriodIndex < periods.length - 1 &&
      periods[currentPeriodIndex + 1].startTimeMs <= s
    ) {
      currentPeriodIndex++;
      currentWeight = periods[currentPeriodIndex].weight;
    }
    return currentWeight;
  });
}
