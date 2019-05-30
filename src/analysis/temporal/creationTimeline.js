// @flow

import sortBy from "lodash.sortby";
import {type MsSinceEpoch} from "../analysisAdapter";
import {type NodeAddressT} from "../../core/graph";

/**
 * An interval expressing a range of time.
 *
 * The interval includes the startTime but not the endTime, i.e. it is half-open
 * as [startTime, endTime).
 */
export type Interval = {+startTime: MsSinceEpoch, +endTime: MsSinceEpoch};

/**
 * Interval-segemented timeline of the creation history of nodes in the graph.
 * Includes the "timeless" nodes (those without any timestamp) in a separate field.
 *
 * This is a classic finnicky algorithm, there are a lot of edge cases to
 * consider, like how the algorithm should handle intervals that don't have any
 * created nodes. (We skip them, which is consistent with viewing the created
 * nodes in each interval as the seed--without any created nodes, we wouldn't
 * be able to provide a valid seed.) This algorithm is pretty thoroughly tested
 * with attention to the edge cases, so take a look at the tests as
 * documentation on how it's supposed to behave.
 */
export type CreationTimeline = {
  creationIntervals: $ReadOnlyArray<{|
    +interval: Interval,
    +nodes: $ReadOnlyArray<NodeAddressT>,
  |}>,
  timelessNodes: $ReadOnlyArray<NodeAddressT>,
};
export function computeCreationTimeline(
  timestamps: Map<NodeAddressT, MsSinceEpoch | null>,
  intervalLengthMs: number
): CreationTimeline {
  if (intervalLengthMs <= 1) {
    throw new Error("interval length must be >= 1");
  }
  const timestampNodes = [];
  const timelessNodes = [];
  for (const [address, timestamp] of timestamps.entries()) {
    if (timestamp == null) {
      timelessNodes.push(address);
    } else {
      timestampNodes.push([address, timestamp]);
    }
  }

  if (timestampNodes.length === 0) {
    return {creationIntervals: [], timelessNodes};
  }
  const timestampSortedNodes = sortBy(timestampNodes, (x) => x[1]);
  let currentInterval = {
    interval: {
      startTime: timestampSortedNodes[0][1],
      endTime: timestampSortedNodes[0][1] + intervalLengthMs,
    },
    nodes: [],
  };
  const creationIntervals = [];
  for (const [n: NodeAddressT, c: MsSinceEpoch] of timestampSortedNodes) {
    while (c >= currentInterval.interval.endTime) {
      // Potential perf optimization: If there are long stretches without any node
      // creation, it's a bit silly to create and then discard these intervals.
      // We could just 'jump ahead' to the next populated interval.
      if (currentInterval.nodes.length > 0) {
        creationIntervals.push(currentInterval);
      }
      currentInterval = {
        interval: {
          startTime: currentInterval.interval.endTime,
          endTime: currentInterval.interval.endTime + intervalLengthMs,
        },
        nodes: [],
      };
    }
    currentInterval.nodes.push(n);
  }
  if (currentInterval.nodes.length > 0) {
    creationIntervals.push(currentInterval);
  }
  return {creationIntervals, timelessNodes};
}
