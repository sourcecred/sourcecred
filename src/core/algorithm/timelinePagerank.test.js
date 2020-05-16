// @flow

import {sum} from "d3-array";
import * as NullUtil from "../../util/null";
import {node, edge, advancedGraph} from "../graphTestUtil";
import {Graph, type NodeAddressT, type EdgeAddressT, type Edge} from "../graph";
import {
  _timelineNodeWeights,
  _timelineNodeToConnections,
  SYNTHETIC_LOOP_WEIGHT,
  _intervalResult,
} from "./timelinePagerank";
import {
  createConnections,
  createOrderedSparseMarkovChain,
  type EdgeWeight,
} from "./graphToMarkovChain";
import {type SparseMarkovChain} from "./markovChain";

describe("src/core/algorithm/timelinePagerank", () => {
  describe("_timelineNodeWeights", () => {
    it("works in a simple case", () => {
      const foo = node("foo");
      const bar = node("bar");
      const nodeCreationHistory = [[foo], [], [bar]];
      const evaluator = (n) => (n === foo.address ? 4 : 1);
      const weights = Array.from(
        _timelineNodeWeights(nodeCreationHistory, evaluator, 0.5)
      );
      const expected = [
        new Map([[foo.address, 2]]),
        new Map([[foo.address, 1]]),
        new Map([
          [foo.address, 0.5],
          [bar.address, 0.5],
        ]),
      ];
      expect(weights).toEqual(expected);
    });
    it("properly normalizes based on the interval decay", () => {
      const foo = node("foo");
      const history = new Array(100).fill([]);
      history[0] = [foo];
      const evaluator = (_) => 42;
      const sumWeight = (decay: number) => {
        const weightsIterator = _timelineNodeWeights(history, evaluator, decay);
        return sum(weightsIterator, (x) => x.get(foo.address));
      };
      expect(sumWeight(0.5)).toBeCloseTo(42);
      expect(sumWeight(0.9)).toBeCloseTo(42);
      expect(sumWeight(0.1)).toBeCloseTo(42);
    });
    it("handles an empty history", () => {
      const weights = _timelineNodeWeights([], (_) => 1, 0.5);
      expect(Array.from(weights)).toHaveLength(0);
    });
  });

  describe("_timelineNodeToConnections", () => {
    it("works for a simple case", () => {
      const a = node("a");
      const b = node("b");
      const e1 = edge("e1", a, b);
      const e2 = edge("e2", a, a);
      const graph = new Graph().addNode(a).addNode(b).addEdge(e1).addEdge(e2);

      function weightsToChain(
        w: Map<EdgeAddressT, EdgeWeight>
      ): SparseMarkovChain {
        const edgeWeight = (e: Edge) =>
          NullUtil.orElse(w.get(e.address), {forwards: 0, backwards: 0});
        const nodeToConnections = createConnections(
          graph,
          edgeWeight,
          SYNTHETIC_LOOP_WEIGHT
        );
        return createOrderedSparseMarkovChain(nodeToConnections).chain;
      }

      const edgeCreationHistory = [[], [e1], [], [e2]];
      const edgeEvaluator = (_) => ({forwards: 1, backwards: 0});
      const nodeToConnectionsIterator = _timelineNodeToConnections(
        graph,
        edgeCreationHistory,
        edgeEvaluator,
        0.5
      );
      const chains = Array.from(nodeToConnectionsIterator).map(
        (x) => createOrderedSparseMarkovChain(x).chain
      );

      const w1 = new Map();
      const chain1 = weightsToChain(w1);
      expect(chains[0]).toEqual(chain1);

      const w2 = new Map().set(e1.address, {forwards: 1, backwards: 0});
      const chain2 = weightsToChain(w2);
      expect(chains[1]).toEqual(chain2);

      const w3 = new Map().set(e1.address, {forwards: 1 / 2, backwards: 0});
      const chain3 = weightsToChain(w3);
      expect(chains[2]).toEqual(chain3);

      const w4 = new Map()
        .set(e1.address, {forwards: 1 / 4, backwards: 0})
        .set(e2.address, {forwards: 1, backwards: 0});
      const chain4 = weightsToChain(w4);
      expect(chains[3]).toEqual(chain4);
    });
  });

  describe("_intervalResult", () => {
    async function example() {
      const {graph1, nodes} = advancedGraph();
      const g = graph1();
      const nodeWeights = new Map()
        .set(nodes.src.address, 1)
        .set(nodes.isolated.address, 2);
      const edgeFn = (_unused_edge) => ({forwards: 1, backwards: 0.5});
      const nodeToConnections = createConnections(g, edgeFn, 1e-3);
      const nodeOrder = Array.from(g.nodes()).map((x) => x.address);
      const edgeOrder = Array.from(g.edges({showDangling: false})).map(
        (x) => x.address
      );
      const interval = {endTimeMs: 1000, startTimeMs: 0};
      const pi0 = null;
      const alpha = 0.05;
      const result = await _intervalResult(
        nodeWeights,
        nodeToConnections,
        nodeOrder,
        edgeOrder,
        interval,
        pi0,
        alpha
      );
      return {
        graph: g,
        nodes,
        nodeOrder,
        edgeOrder,
        nodeWeights,
        edgeFn,
        nodeToConnections,
        interval,
        pi0,
        alpha,
        result,
      };
    }
    it("passes through the interval", async () => {
      const {result, interval} = await example();
      expect(result.interval).toEqual(interval);
    });
    it("computes the summed nodeWeight", async () => {
      const {result, nodeWeights} = await example();
      const actualIntervalWeight = sum(nodeWeights.values());
      expect(result.intervalWeight).toEqual(actualIntervalWeight);
    });
    it("produces sane score distribution on an example graph", async () => {
      const {result, nodes, nodeOrder} = await example();
      function getScore(a) {
        const idx = nodeOrder.indexOf(a.address);
        if (idx === -1) {
          throw new Error("bad address");
        }
        return result.distribution[idx];
      }
      const isoScore = getScore(nodes.isolated);
      const srcScore = getScore(nodes.src);
      const dstScore = getScore(nodes.dst);
      expect(isoScore + srcScore + dstScore).toBeCloseTo(1, 4);
      // It has 2/3rd weight, and is isolated, so it's simple
      expect(isoScore).toBeCloseTo(2 / 3, 4);
      // src has the weight, and dst doesnt, so it should have a higher score
      expect(srcScore).toBeGreaterThan(dstScore);
    });
    it("satisfies the flow conservation invariants", async () => {
      const {nodeOrder, edgeOrder, result, graph} = await example();
      const {
        distribution,
        forwardFlow,
        backwardFlow,
        syntheticLoopFlow,
        seedFlow,
      } = result;
      // For any node: Its score is equal to the sum of:
      // - The score it received from the seed vector
      // - The score it received from every in edge
      // - The score it received from every out edge
      // - The score it received from its self loop
      const nodeToExpectedScore = new Map();
      function addScore(a: NodeAddressT, score: number) {
        const existing = nodeToExpectedScore.get(a) || 0;
        nodeToExpectedScore.set(a, existing + score);
      }
      nodeOrder.forEach((na, i) => {
        addScore(na, seedFlow[i] + syntheticLoopFlow[i]);
      });
      edgeOrder.forEach((ea, i) => {
        const {src, dst} = NullUtil.get(graph.edge(ea));
        addScore(src, backwardFlow[i]);
        addScore(dst, forwardFlow[i]);
      });
      nodeOrder.forEach((na, i) => {
        const expected = nodeToExpectedScore.get(na);
        const actual = distribution[i];
        expect(expected).toBeCloseTo(actual, 4);
      });
    });
  });
});
