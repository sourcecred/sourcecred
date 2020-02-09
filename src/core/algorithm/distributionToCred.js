// @flow

/**
 * Takes timeline distributions and uses them to create normalized cred.
 */

import {sum} from "d3-array";
import {toCompat, fromCompat, type Compatible} from "../../util/compat";
import {type Interval} from "../interval";
import {type TimelineDistributions} from "./timelinePagerank";
import {NodeAddress, type NodeAddressT} from "../../core/graph";

export opaque type NodeOrderedCredScores: Float64Array = Float64Array;

/**
 * Represents cred scores over time.
 *
 * It contains an array of intervals, which give timing information, and an
 * array of CredTimeSlices, which are Float64Arrays. Each CredTimeSlice
 * contains cred scores for an interval. The cred scores are included in
 * node-address-sorted order, and as such the CredScores can only be
 * interpreted in the context of an associated Graph.
 *
 * As invariants, it is guaranteed that:
 * - intervals and intervalCredScores will always have the same length
 * - all of the intervalCredScores will have a consistent implicit node ordering
 *
 * The type is marked opaque so that no-one else can construct instances that
 * don't conform to these invariants.
 */
export opaque type TimelineCredScores: {|
  +intervals: $ReadOnlyArray<Interval>,
  +intervalCredScores: $ReadOnlyArray<NodeOrderedCredScores>,
|} = {|
  +intervals: $ReadOnlyArray<Interval>,
  +intervalCredScores: $ReadOnlyArray<NodeOrderedCredScores>,
|};

/**
 * Convert a TimelineDistribution into CredScores.
 *
 * The difference between the distribution and cred is that cred has been
 * re-normalized to present human-agreeable scores, rather than a probability
 * distribution.
 *
 * This implementation normalizes the scores so that in each interval, the
 * total score of every node matching a scoringNodePrefix is equal to the
 * interval's weight.
 *
 * Edge cases:
 *     - If in an interval the sum of the scoring nodes' distribution is 0,
 *       return a total cred score of 0 for all nodes in the interval.
 *     - If none of the nodes match a scoring node prefix, return
 *       a total cred score of 0 for all nodes in all intervals.
 *
 */
export function distributionToCred(
  ds: TimelineDistributions,
  nodeOrder: $ReadOnlyArray<NodeAddressT>,
  scoringNodePrefixes: $ReadOnlyArray<NodeAddressT>
): TimelineCredScores {
  if (ds.length === 0) {
    return {intervals: [], intervalCredScores: []};
  }
  const scoringNodeIndices = [];
  for (let i = 0; i < nodeOrder.length; i++) {
    const addr = nodeOrder[i];
    if (scoringNodePrefixes.some((x) => NodeAddress.hasPrefix(addr, x))) {
      scoringNodeIndices.push(i);
    }
  }
  const intervals = ds.map((x) => x.interval);
  const intervalCredScores = ds.map(({distribution, intervalWeight}) => {
    const intervalTotalScore = sum(
      scoringNodeIndices.map((x) => distribution[x])
    );

    const intervalNormalizer =
      intervalTotalScore === 0 ? 0 : intervalWeight / intervalTotalScore;
    const cred = distribution.map((x) => x * intervalNormalizer);
    return cred;
  });
  return {intervalCredScores, intervals};
}

const COMPAT_INFO = {type: "sourcecred/timelineCredScores", version: "0.1.0"};

export type TimelineCredScoresJSON = Compatible<{|
  +intervals: $ReadOnlyArray<Interval>,
  // TODO: Serializing floats as strings is space-inefficient. We can likely
  // get space savings if we base64 encode a byte representation of the
  // floats.
  +intervalCredScores: $ReadOnlyArray<$ReadOnlyArray<number>>,
|}>;

export function toJSON(s: TimelineCredScores): TimelineCredScoresJSON {
  return toCompat(COMPAT_INFO, {
    intervals: s.intervals,
    intervalCredScores: s.intervalCredScores.map((x) => Array.from(x)),
  });
}

export function fromJSON(j: TimelineCredScoresJSON): TimelineCredScores {
  const {intervals, intervalCredScores} = fromCompat(COMPAT_INFO, j);
  return {
    intervals,
    intervalCredScores: intervalCredScores.map((x) => new Float64Array(x)),
  };
}
