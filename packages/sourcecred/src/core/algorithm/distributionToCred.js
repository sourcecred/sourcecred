// @flow

/**
 * Takes timeline distributions and uses them to create normalized cred.
 */

import {sum} from "d3-array";
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
  // For each node: Its raw Cred score for this interval based on running
  // TimelinePagerank on the Contribution Graph.
  // Does not include dependency mintedCred.
  +cred: NodeOrderedCredScores,
  // For each edge: How much raw Cred flowed along its forward direction.
  +forwardFlow: EdgeOrderedCredScores,
  // For each edge: How much raw Cred flowed along its backward direction.
  +backwardFlow: EdgeOrderedCredScores,
  // For each Node: How much of its Cred came via its connection to the seed
  // (source of all Cred). This is already included in the cred score, is
  // computed separately for analysis purposes.
  +seedFlow: NodeOrderedCredScores,
  // For each Node: How much of its Cred came via its synthetic self loop. This
  // is already included in the cred score, is computed separately for analysis
  // purposes.
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
