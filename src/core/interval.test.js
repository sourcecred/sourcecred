// @flow

import {utcWeek} from "d3-time";
import {node, edge} from "./graphTestUtil";
import {Graph} from "./graph";
import {
  partitionGraph,
  graphIntervals,
  weekIntervals,
  intervalSequence,
} from "./interval";

describe("src/core/interval", () => {
  describe("intervalSequence", () => {
    it("accepts an empty sequence", () => {
      expect(intervalSequence([])).toEqual([]);
    });
    it("accepts a sequence with a single interval", () => {
      const i = {startTimeMs: 0, endTimeMs: 100};
      expect(intervalSequence([i])).toEqual([i]);
    });
    it("accepts the dual-infinity interval", () => {
      const i = {startTimeMs: -Infinity, endTimeMs: Infinity};
      expect(intervalSequence([i])).toEqual([i]);
    });
    it("accepts a good sequence with two intervals", () => {
      const i0 = {startTimeMs: 0, endTimeMs: 100};
      const i1 = {startTimeMs: 100, endTimeMs: 200};
      expect(intervalSequence([i0, i1])).toEqual([i0, i1]);
    });
    it("rejects a sequence with a gap", () => {
      const i0 = {startTimeMs: 0, endTimeMs: 100};
      const i1 = {startTimeMs: 101, endTimeMs: 200};
      const thunk = () => intervalSequence([i0, i1]);
      expect(thunk).toThrowError(
        "last interval ended at 100 but this interval starts at 101"
      );
    });
    it("rejects a sequence with overlap", () => {
      const i0 = {startTimeMs: 0, endTimeMs: 100};
      const i1 = {startTimeMs: 99, endTimeMs: 200};
      const thunk = () => intervalSequence([i0, i1]);
      expect(thunk).toThrowError(
        "last interval ended at 100 but this interval starts at 99"
      );
    });
    it("rejects a sequence with a zero-length interval", () => {
      const i0 = {startTimeMs: 0, endTimeMs: 100};
      const i1 = {startTimeMs: 100, endTimeMs: 100};
      const thunk = () => intervalSequence([i0, i1]);
      expect(thunk).toThrowError("must have positive length");
    });
    it("rejects a sequence that is out of order", () => {
      const i0 = {startTimeMs: 0, endTimeMs: 100};
      const i1 = {startTimeMs: 100, endTimeMs: 200};
      const thunk = () => intervalSequence([i1, i0]);
      expect(thunk).toThrowError(
        "last interval ended at 200 but this interval starts at 0"
      );
    });
    it("rejects a sequence with a negative length interval", () => {
      const i0 = {startTimeMs: 0, endTimeMs: 100};
      const i1 = {startTimeMs: 100, endTimeMs: 99};
      const thunk = () => intervalSequence([i1, i0]);
      expect(thunk).toThrowError("interval must have positive length");
    });
    it("accepts a sequence with -Infinity and +Infinity", () => {
      const i0 = {startTimeMs: -Infinity, endTimeMs: 100};
      const i1 = {startTimeMs: 100, endTimeMs: +Infinity};
      expect(intervalSequence([i0, i1])).toEqual([i0, i1]);
    });
    it("rejects a sequence with NaNs", () => {
      const i0 = {startTimeMs: 0, endTimeMs: NaN};
      const i1 = {startTimeMs: 100, endTimeMs: 200};
      const thunk = () => intervalSequence([i0, i1]);
      expect(thunk).toThrowError("NaN");
    });
    it("resists mutation of the intervals", () => {
      const i0 = {startTimeMs: 0, endTimeMs: 100};
      const i1 = {startTimeMs: 100, endTimeMs: 200};
      const is = intervalSequence([i0, i1]);
      // $FlowExpectedError[cannot-write]
      i1.startTimeMs = 300;
      intervalSequence(is);
      expect(is[0].startTimeMs).toEqual(0);
    });
  });

  const WEEK_MID = 1562501362239;
  const WEEK_START = +utcWeek.floor(WEEK_MID);
  const WEEK_END = +utcWeek.ceil(WEEK_MID);
  const week = (n) => +utcWeek.offset(WEEK_MID, n);
  function graphWithTiming(
    nodeTimes: (number | null)[],
    edgeTimes: number[]
  ): Graph {
    const graph = new Graph();
    const timeless = {...node("timeless"), timestampMs: null};
    // Add a timeless node so we can ensure all the edges are non-dangling
    graph.addNode(timeless);
    for (let i = 0; i < nodeTimes.length; i++) {
      const n = node(String(i));
      const nt = nodeTimes[i];
      const timestampMs = nt == null ? null : week(nt);
      graph.addNode({...n, timestampMs});
    }
    for (let i = 0; i < edgeTimes.length; i++) {
      const e = edge(String(i), timeless, timeless);
      graph.addEdge({...e, timestampMs: week(edgeTimes[i])});
    }
    return graph;
  }

  describe("partitionGraph", () => {
    function checkPartition(g: Graph) {
      const slices = partitionGraph(g);
      const expectedIntervals = graphIntervals(g);
      expect(slices.map((x) => x.interval)).toEqual(expectedIntervals);

      const seenNodeAddresses = new Set();
      const seenEdgeAddresses = new Set();
      for (const {interval, nodes, edges} of slices) {
        for (const {address, timestampMs} of nodes) {
          expect(timestampMs).not.toBe(null);
          expect(timestampMs).toBeGreaterThanOrEqual(interval.startTimeMs);
          expect(timestampMs).toBeLessThan(interval.endTimeMs);
          expect(seenNodeAddresses.has(address)).toBe(false);
          seenNodeAddresses.add(address);
        }
        for (const {address, timestampMs} of edges) {
          expect(timestampMs).toBeGreaterThanOrEqual(interval.startTimeMs);
          expect(timestampMs).toBeLessThan(interval.endTimeMs);
          expect(seenEdgeAddresses.has(address)).toBe(false);
          seenEdgeAddresses.add(address);
        }
      }
      const timefulNodes = Array.from(g.nodes()).filter(
        (x) => x.timestampMs != null
      );
      expect(timefulNodes).toHaveLength(seenNodeAddresses.size);
      const edges = Array.from(g.edges({showDangling: false}));
      expect(edges).toHaveLength(seenEdgeAddresses.size);
    }

    it("partitions an empty graph correctly", () => {
      checkPartition(new Graph());
    });
    it("partitions a graph with just nodes", () => {
      checkPartition(graphWithTiming([5, 3, 99, 12], []));
    });
    it("partitions a graph with just edges", () => {
      checkPartition(graphWithTiming([], [3, 4, 99]));
    });
    it("partitions a graph with nodes and edges", () => {
      checkPartition(graphWithTiming([3, 9], [4, 12]));
    });
    it("partitions a graph with dangling edges", () => {
      const graph = graphWithTiming([3, 9], [4, 12]);
      const n = node("nope");
      const d = edge("dangling", n, n);
      graph.addEdge(d);
      checkPartition(graph);
    });
  });

  describe("graphIntervals", () => {
    it("an empty graph has no intervals", () => {
      const intervals = graphIntervals(new Graph());
      expect(intervals).toHaveLength(0);
    });
    it("a graph with only timeless nodes has no intervals", () => {
      const graph = graphWithTiming([null, null], []);
      const intervals = graphIntervals(graph);
      expect(intervals).toHaveLength(0);
    });
    it("a graph with only dangling edges has no intervals", () => {
      const graph = new Graph();
      const n = node("nonexistent");
      const e = {...edge("dangling", n, n), timestampMs: WEEK_MID};
      graph.addEdge(e);
      const intervals = graphIntervals(graph);
      expect(intervals).toHaveLength(0);
    });
    it("timing information comes from the nodes and the edges", () => {
      // Note that the nodes/edges have not been added in time-sorted order,
      // and that the max time comes from the edges while the min time comes from the nodes.
      const graph = graphWithTiming([3, 1, 9], [2, 14, 3]);
      const intervals = graphIntervals(graph);
      expect(intervals).toEqual(weekIntervals(week(1), week(14)));
    });
  });

  describe("weekIntervals", () => {
    it("produces a covering interval for a single timestamp", () => {
      const intervals = weekIntervals(WEEK_MID, WEEK_MID);
      expect(intervals).toEqual([
        {
          startTimeMs: WEEK_START,
          endTimeMs: WEEK_END,
        },
      ]);
    });
    it("produces a correct interval for a single timestamp aligned on week start", () => {
      const intervals = weekIntervals(WEEK_START, WEEK_START);
      expect(intervals).toEqual([
        {
          startTimeMs: WEEK_START,
          endTimeMs: WEEK_END,
        },
      ]);
    });
    it("produces one interval if passed start and end-1", () => {
      const intervals = weekIntervals(WEEK_START, WEEK_END - 1);
      expect(intervals).toEqual([
        {
          startTimeMs: WEEK_START,
          endTimeMs: WEEK_END,
        },
      ]);
    });
    it("produces two intervals if passed start and end of week", () => {
      const intervals = weekIntervals(WEEK_START, WEEK_END);
      // It needs to have this behavior because the intervals are defined as half-open.
      // So if there is a node with timestamp WEEK_END, it will need to fall at the start
      // of the subsequent interval.
      expect(intervals).toEqual([
        {
          startTimeMs: WEEK_START,
          endTimeMs: WEEK_END,
        },
        {
          startTimeMs: WEEK_END,
          endTimeMs: +utcWeek.ceil(WEEK_END + 1),
        },
      ]);
    });
    it("produces three intervals if the boundaries extend past a week on both sides", () => {
      const intervals = weekIntervals(WEEK_START - 1, WEEK_END + 1);
      expect(intervals).toEqual([
        {
          startTimeMs: +utcWeek.floor(WEEK_START - 1),
          endTimeMs: WEEK_START,
        },
        {
          startTimeMs: WEEK_START,
          endTimeMs: WEEK_END,
        },
        {
          startTimeMs: WEEK_END,
          endTimeMs: +utcWeek.ceil(WEEK_END + 1),
        },
      ]);
    });
  });
});
