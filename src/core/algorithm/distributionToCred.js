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
 * The TimelineCredScores consists of a time-ordered array of IntervalCreds.
 * Each IntervalCred contains the interval information, as well as the raw
 * cred score for every node in the graph. The cred is stored as a Float64Array,
 * with scores corresponding to nodes by the node's index in the Graph's
 * canonical address-sorted node ordering.
 */
export type TimelineCredScores = $ReadOnlyArray<IntervalCred>;

export type IntervalCred = {|
  +interval: Interval,
  +cred: NodeOrderedCredScores,
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
  const scoringNodeIndices = [];
  for (let i = 0; i < nodeOrder.length; i++) {
    const addr = nodeOrder[i];
    if (scoringNodePrefixes.some((x) => NodeAddress.hasPrefix(addr, x))) {
      scoringNodeIndices.push(i);
    }
  }
  return ds.map(({interval, distribution, intervalWeight}) => {
    const intervalTotalScore = sum(
      scoringNodeIndices.map((x) => distribution[x])
    );

    const intervalNormalizer =
      intervalTotalScore === 0 ? 0 : intervalWeight / intervalTotalScore;
    const cred = distribution.map((x) => x * intervalNormalizer);
    return {interval, cred};
  });
}

const COMPAT_INFO = {type: "sourcecred/timelineCredScores", version: "0.2.0"};

export type TimelineCredScoresJSON = Compatible<
  $ReadOnlyArray<{|
    +interval: Interval,
    // TODO: Serializing floats as strings is space-inefficient. We can likely
    // get space savings if we base64 encode a byte representation of the
    // floats.
    +cred: $ReadOnlyArray<number>,
  |}>
>;

export function toJSON(s: TimelineCredScores): TimelineCredScoresJSON {
  return toCompat(
    COMPAT_INFO,
    s.map(({interval, cred}) => ({interval, cred: Array.from(cred)}))
  );
}

export function fromJSON(j: TimelineCredScoresJSON): TimelineCredScores {
  const scoreArray = fromCompat(COMPAT_INFO, j);
  return scoreArray.map(({cred, interval}) => ({
    cred: new Float64Array(cred),
    interval,
  }));
}
