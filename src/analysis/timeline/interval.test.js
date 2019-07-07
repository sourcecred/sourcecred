// @flow

import {utcWeek} from "d3-time";
import {node, edge} from "../../core/graphTestUtil";
import {Graph} from "../../core/graph";
import {partitionGraph, graphIntervals, weekIntervals} from "./interval";

describe("src/analysis/timeline/interval", () => {
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
