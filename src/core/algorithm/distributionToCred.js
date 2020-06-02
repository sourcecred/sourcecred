// @flow

/**
 * Takes timeline distributions and uses them to create normalized cred.
 */

import {sum} from "d3-array";
import {toCompat, fromCompat, type Compatible} from "../../util/compat";
import {type Interval} from "../interval";
import {type TimelineDistributions} from "./timelinePagerank";
import {NodeAddress, type NodeAddressT} from "../../core/graph";

export type NodeOrderedCredScores = Float64Array;
export type EdgeOrderedCredScores = Float64Array;

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
  +forwardFlow: EdgeOrderedCredScores,
  +backwardFlow: EdgeOrderedCredScores,
  +seedFlow: NodeOrderedCredScores,
  +syntheticLoopFlow: NodeOrderedCredScores,
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
  return ds.map(
    ({
      interval,
      distribution,
      intervalWeight,
      forwardFlow,
      backwardFlow,
      syntheticLoopFlow,
      seedFlow,
    }) => {
      const intervalTotalScore = sum(
        scoringNodeIndices.map((x) => distribution[x])
      );

      const intervalNormalizer =
        intervalTotalScore === 0 ? 0 : intervalWeight / intervalTotalScore;
      const normalize = (arr) => arr.map((x) => x * intervalNormalizer);
      return {
        interval,
        cred: normalize(distribution),
        forwardFlow: normalize(forwardFlow),
        backwardFlow: normalize(backwardFlow),
        seedFlow: normalize(seedFlow),
        syntheticLoopFlow: normalize(syntheticLoopFlow),
      };
    }
  );
}

const COMPAT_INFO = {type: "sourcecred/timelineCredScores", version: "0.2.0"};

export type TimelineCredScoresJSON = Compatible<
  $ReadOnlyArray<{|
    +interval: Interval,
    // TODO: Serializing floats as strings is space-inefficient. We can likely
    // get space savings if we base64 encode a byte representation of the
    // floats.
    +cred: $ReadOnlyArray<number>,
    +forwardFlow: $ReadOnlyArray<number>,
    +backwardFlow: $ReadOnlyArray<number>,
    +seedFlow: $ReadOnlyArray<number>,
    +syntheticLoopFlow: $ReadOnlyArray<number>,
  |}>
>;

export function toJSON(s: TimelineCredScores): TimelineCredScoresJSON {
  return toCompat(
    COMPAT_INFO,
    s.map(
      ({
        interval,
        cred,
        forwardFlow,
        backwardFlow,
        seedFlow,
        syntheticLoopFlow,
      }) => ({
        interval,
        cred: Array.from(cred),
        forwardFlow: Array.from(forwardFlow),
        backwardFlow: Array.from(backwardFlow),
        seedFlow: Array.from(seedFlow),
        syntheticLoopFlow: Array.from(syntheticLoopFlow),
      })
    )
  );
}

export function fromJSON(j: TimelineCredScoresJSON): TimelineCredScores {
  const scoreArray = fromCompat(COMPAT_INFO, j);
  return scoreArray.map(
    ({
      cred,
      interval,
      forwardFlow,
      backwardFlow,
      seedFlow,
      syntheticLoopFlow,
    }) => ({
      cred: new Float64Array(cred),
      forwardFlow: new Float64Array(forwardFlow),
      backwardFlow: new Float64Array(backwardFlow),
      seedFlow: new Float64Array(seedFlow),
      syntheticLoopFlow: new Float64Array(syntheticLoopFlow),
      interval,
    })
  );
}
