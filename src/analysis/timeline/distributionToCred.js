// @flow

/**
 * Takes timeline distributions and uses them to create normalized cred.
 */

import {sum} from "d3-array";
import {type Interval} from "./interval";
import {type TimelineDistributions} from "./timelinePagerank";
import {NodeAddress, type NodeAddressT} from "../../core/graph";

/**
 * Represents the full timeline cred for a graph.
 */
export type FullTimelineCred = $ReadOnlyArray<{|
  // The interval for this slice.
  +interval: Interval,
  // The cred for each node.
  // (Uses the graph's canonical node ordering.)
  +cred: Float64Array,
|}>;

/**
 * Convert a TimelineDistribution into TimelineCred.
 *
 * The difference between the distribution and cred is that cred has been
 * re-normalized to present human-agreeable scores, rather than a probability
 * distribution.
 *
 * This implementation normalizes the scores so that in each interval, the
 * total score of every node matching scoringNodePrefix is equal to the
 * interval's weight.
 */
export function distributionToCred(
  ds: TimelineDistributions,
  nodeOrder: $ReadOnlyArray<NodeAddressT>,
  scoringNodePrefix: NodeAddressT
): FullTimelineCred {
  if (ds.length === 0) {
    return [];
  }
  const intervals = ds.map((x) => x.interval);
  const scoringNodeIndices = [];
  const cred = new Array(nodeOrder.length);
  for (let i = 0; i < nodeOrder.length; i++) {
    if (NodeAddress.hasPrefix(nodeOrder[i], scoringNodePrefix)) {
      scoringNodeIndices.push(i);
    }
    cred[i] = new Array(intervals.length);
  }
  if (scoringNodeIndices.length === 0) {
    throw new Error("no nodes matched scoringNodePrefix");
  }

  return ds.map(({interval, distribution, intervalWeight}) => {
    const intervalTotalScore = sum(
      scoringNodeIndices.map((x) => distribution[x])
    );
    const intervalNormalizer = intervalWeight / intervalTotalScore;
    const cred = distribution.map((x) => x * intervalNormalizer);
    return {interval, cred};
  });
}
