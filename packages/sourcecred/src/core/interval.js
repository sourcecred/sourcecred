// @flow

import {max, min} from "d3-array";
import sortBy from "../util/sortBy";
import {utcWeek} from "d3-time";
import * as NullUtil from "../util/null";
import type {TimestampMs} from "../util/timestamp";
import type {Node, Edge, Graph} from "./graph";
import * as C from "../util/combo";

/**
 * Represents a time interval
 * The interval is half open [startTimeMs, endTimeMs),
 * i.e. if a timestamp is exactly on the interval boundary, it will fall at the
 * start of the older interval.
 */
export type Interval = {|
  +startTimeMs: TimestampMs,
  +endTimeMs: TimestampMs,
|};

/**
 * An interval sequence is an array of intervals with the following guarantees:
 * - Every interval has positive time span (i.e. the end time is greater
 *   than the start time).
 * - Every interval except for the first starts at the same time that the
 *   previous interval ended.
 * - No interval may have a NaN start or end time. (Infinity is OK.)
 */
export opaque type IntervalSequence: $ReadOnlyArray<Interval> = $ReadOnlyArray<Interval>;

export function intervalSequence(
  intervals: $ReadOnlyArray<Interval>
): IntervalSequence {
  let lastEndTime = null;
  for (const {startTimeMs, endTimeMs} of intervals) {
    if (isNaN(startTimeMs) || isNaN(endTimeMs)) {
      throw new Error(`NaN in interval [${startTimeMs}, ${endTimeMs}]`);
    }
    if (lastEndTime != null && startTimeMs !== lastEndTime) {
      throw new Error(
        `last interval ended at ${lastEndTime} but this interval starts at ${startTimeMs}`
      );
    }
    if (endTimeMs <= startTimeMs) {
      throw new Error(
        `interval must have positive length, but got [${startTimeMs}, ${endTimeMs}]`
      );
    }
    lastEndTime = endTimeMs;
  }
  // Reconstruct the objects so mutating the input won't break the IntervalSequence
  return intervals.map(({startTimeMs, endTimeMs}) => ({
    startTimeMs,
    endTimeMs,
  }));
}

export const intervalSequenceParser: C.Parser<IntervalSequence> = C.array(
  C.object({
    startTimeMs: C.number,
    endTimeMs: C.number,
  })
).fmap((arr) => intervalSequence(arr));

/**
 * Represents a slice of a time-partitioned graph
 * Includes the interval, as well as all of the nodes and edges whose timestamps
 * are within the interval.
 */
export type GraphInterval = {|
  +interval: Interval,
  +nodes: $ReadOnlyArray<Node>,
  +edges: $ReadOnlyArray<Edge>,
|};

export type GraphIntervalPartition = $ReadOnlyArray<GraphInterval>;

type TimefulNode = {|...Node, timestampMs: TimestampMs|};

/**
 * Partition a graph based on time intervals.
 *
 * The intervals are always one week long, as calculated using d3.utcWeek.
 * The result may contain empty intervals.
 * If the graph is empty, no intervals are returned.
 * Timeless nodes are not included in the partition, nor are dangling edges.
 */
export function partitionGraph(graph: Graph): GraphIntervalPartition {
  const nodes = Array.from(graph.nodes());
  const timefulNodes: $ReadOnlyArray<TimefulNode> = (nodes.filter(
    (x) => x.timestampMs != null
  ): any);
  const sortedNodes = sortBy(timefulNodes, (x) => x.timestampMs);
  const edges = Array.from(graph.edges({showDangling: false}));
  const sortedEdges = sortBy(edges, (x) => x.timestampMs);
  const intervals = graphIntervals(graph);
  let nodeIndex = 0;
  let edgeIndex = 0;
  return intervals.map((interval) => {
    const nodes = [];
    const edges = [];
    while (
      nodeIndex < sortedNodes.length &&
      sortedNodes[nodeIndex].timestampMs < interval.endTimeMs
    ) {
      nodes.push(sortedNodes[nodeIndex++]);
    }
    while (
      edgeIndex < sortedEdges.length &&
      sortedEdges[edgeIndex].timestampMs < interval.endTimeMs
    ) {
      edges.push(sortedEdges[edgeIndex++]);
    }
    return {interval, nodes, edges};
  });
}

/**
 * Produce an array of Intervals which cover all the node and edge timestamps
 * for a graph.
 *
 * The intervals are one week long, and are aligned on clean week boundaries.
 *
 * This function is basically a wrapper around weekIntervals that makes sure
 * the graph's nodes and edges are all accounted for properly.
 */
export function graphIntervals(graph: Graph): IntervalSequence {
  const nodeTimestamps = Array.from(graph.nodes())
    .map((x) => x.timestampMs)
    .filter((x) => x != null)
    // Unnecessary map is to satisfy flow that the array doesn't contain null.
    .map((x) => NullUtil.get(x));
  const edgeTimestamps = Array.from(graph.edges({showDangling: false})).map(
    (x) => x.timestampMs
  );
  if (nodeTimestamps.length === 0 && edgeTimestamps.length === 0) {
    return [];
  }
  const allTimestamps = nodeTimestamps.concat(edgeTimestamps);
  const start = min(allTimestamps);
  const end = max(allTimestamps);
  return weekIntervals(start, end);
}

/**
 * Produce an array of week-long intervals to cover the startTime and endTime.
 *
 * Each interval is one week long and aligned on week boundaries, as produced
 * by d3.utcWeek. The weeks always use UTC boundaries to ensure consistent
 * output regardless of which timezone the user is in.
 *
 * Assuming that the inputs are valid, there will always be at least one
 * interval, so that that interval can cover the input timestamps. (E.g. if
 * startMs and endMs are the same value, then the produced interval will be the
 * start and end of the last week that starts on or before startMs.)
 */
export function weekIntervals(
  startMs: number,
  endMs: number
): IntervalSequence {
  if (!isFinite(startMs) || !isFinite(endMs)) {
    throw new Error("invalid non-finite input");
  }
  if (typeof startMs !== "number" || typeof endMs !== "number") {
    throw new Error("start or end are not numbers");
  }
  if (startMs > endMs) {
    throw new Error("start time after end time");
  }
  // Promote the window to the nearest week boundaries, to ensure that
  // utcWeek.range will not return an empty array.
  // We add one to the endTime so that just in case we're exactly on a week
  // boundary, we still get at least one interval.
  startMs = utcWeek.floor(startMs);
  endMs = utcWeek.ceil(endMs + 1);
  const boundaries = utcWeek.range(startMs, endMs);
  boundaries.push(endMs);
  const intervals = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    intervals.push({
      startTimeMs: +boundaries[i],
      endTimeMs: +boundaries[i + 1],
    });
  }
  return intervalSequence(intervals);
}
