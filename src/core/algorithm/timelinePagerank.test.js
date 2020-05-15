// @flow

import {sum} from "d3-array";
import * as NullUtil from "../../util/null";
import {node, edge} from "../graphTestUtil";
import {Graph, type EdgeAddressT, type Edge} from "../graph";
import {
  _timelineNodeWeights,
  _timelineNodeToConnections,
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
        const nodeToConnections = createConnections(graph, edgeWeight, 1e-3);
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
});
