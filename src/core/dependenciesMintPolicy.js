// @flow

/**
 * This module adds a core type for specifying "Dependency Mint" policies.
 * The Dependency Minting system is how we intend to allow projects to
 * flow Cred to their dependencies; e.g. it is how a user of SourceCred may
 * flow Cred to SourceCred itself. We want to make this easily configured at
 * the whole-project level, so that e.g. we can make projects flow ~5% of their
 * Cred to SourceCred by default.
 *
 * It's not obvious how to embed this information directly into the Contribution
 * Graph in a way that's elegant and computationally efficient. E.g. we could add
 * an edge from every individual contribution to each dependency, but that
 * greatly increases the size and max degree of the Graph, which is
 * undesirable. After some discussion and consideration of alternatives,
 * @decentralion and @wchargin decided it would be cleanest to handle this
 * outside of the normal Graph abstraction. Thus, the Dependency Mint Policy was
 * born. These policies specify that after normal, Graph-based Cred computation is
 * finished, some nodes will recieve "extra" Cred minting which is proportional
 * to the total pre-dependencies Cred.
 *
 * The total amount of Cred that may be minted is unbounded; for example, if
 * the dependencies have a total weight of 0.2, then the total Cred will be
 * 120% of the base Cred, but if the dependencies had a total weight of 1, then
 * the total Cred would be double the base Cred. This was a deliberate design
 * decision so that dependency minting would feel "non-rival", i.e. there is
 * not a fixed budget of dependency cred that must be split between the
 * dependencies. In many cases, it may be very reasonable for the total Cred
 * flowing to a project's dependencies to be larger than the total Cred flowing
 * directly to the project's contributors; consider that the total amount of
 * time/effort invested in building all the dependencies may be orders of
 * magnitude larger than investment in the project itself.
 *
 * In the future, we may develop more elegant approaches that integrate
 * dependencies more naturally into the contribution graph itself, in which
 * case we could phase out this system. But for now, it seems like a
 * sufficiently useful and flexible abstraction to merit inclusion in core/.
 *
 * Note that there's nothing in the implementation or data types that imply
 * that this is only used for dependencies; one could imagine using it for
 * other purposes, e.g. minting extra Cred for moderators of a forum, or for
 * maintainers of a project. However, we have a prior that all contributors to
 * a project should be paid via CredRank and the graph-based system, rather
 * than "out-of-band" fiat/configuration like the mint policies in this module.
 * Thus, we're naming it the dependencyMintPolicy to communicate that
 * intention.
 */
import {type NodeAddressT, NodeAddress} from "./graph";
import {type TimestampMs} from "../util/timestamp";
import {type IntervalSequence} from "./interval";

export type DependencyMintPolicy = {|
  // The node address that will receieve the extra minted Cred
  +address: NodeAddressT,
  // Information on how the Cred minting weight varies in time.
  +periods: $ReadOnlyArray<DependencyMintPeriod>,
|};

export type DependencyMintPeriod = {|
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

/**
 * The ProcessedDependencyMintPolicy is a DependencyMintPolicy which has
 * been transformed so that it matches the abstractions available when
 * we're doing raw cred computation: instead of an address, we track an index
 * into the canonical node order, and rather than arbitrary client-provided
 * periods, we compute the weight for each Interval.
 */
export type ProcessedDependencyMintPolicy = {|
  +nodeIndex: number,
  +intervalWeights: $ReadOnlyArray<number>,
|};

export function processMintPolicy(
  policy: DependencyMintPolicy,
  nodeOrder: $ReadOnlyArray<NodeAddressT>,
  intervals: IntervalSequence
): ProcessedDependencyMintPolicy {
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
  periods: $ReadOnlyArray<DependencyMintPeriod>,
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
