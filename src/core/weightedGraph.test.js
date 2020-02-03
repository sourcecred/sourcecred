// @flow

import * as Weights from "./weights";
import {Graph, NodeAddress, EdgeAddress} from "./graph";
import * as WeightedGraph from "./weightedGraph";
import * as GraphTest from "./graphTestUtil";

describe("core/weightedGraph", () => {
  function expectEqual(wg1, wg2) {
    expect(wg1.graph.equals(wg2.graph)).toBe(true);
    expect(wg1.weights).toEqual(wg2.weights);
  }
  const foo = GraphTest.node("foo");
  const bar = GraphTest.node("bar");
  const foobar = GraphTest.edge("foobar", foo, bar);

  describe("empty", () => {
    it("empty produces an empty WeightedGraph", () => {
      const {weights, graph} = WeightedGraph.empty();
      expect(graph.equals(new Graph())).toBe(true);
      expect(weights).toEqual(Weights.empty());
    });
  });

  describe("toJSON/fromJSON", () => {
    it("works for an empty WeightedGraph", () => {
      const wg = WeightedGraph.empty();
      const wgJSON = WeightedGraph.toJSON(wg);
      const wg_ = WeightedGraph.fromJSON(wgJSON);
      expectEqual(wg, wg_);
    });
    it("works for a non-empty WeightedGraph", () => {
      const node = GraphTest.node("foo");
      const graph = new Graph().addNode(node);
      const weights = Weights.empty();
      weights.nodeWeights.set(node.address, 5);
      const wg = {graph, weights};
      const wgJSON = WeightedGraph.toJSON(wg);
      const wg_ = WeightedGraph.fromJSON(wgJSON);
      expectEqual(wg, wg_);
    });
  });

  describe("merge", () => {
    it("merge works on nontrivial graph", () => {
      // Not attempting to validate edge case semantics here, since this is just
      // a wrapper around Graph.merge and WeightedGraph.merge; those functions
      // are tested more thoroughly.
      const g1 = new Graph().addNode(foo);
      const g2 = new Graph().addNode(bar);
      const w1 = Weights.empty();
      w1.nodeWeights.set(foo.address, 1);
      const w2 = Weights.empty();
      w2.nodeWeights.set(bar.address, 2);
      const wg1 = {graph: g1, weights: w1};
      const wg2 = {graph: g2, weights: w2};
      const g = Graph.merge([g1, g2]);
      const w = Weights.merge([w1, w2]);
      const wg = WeightedGraph.merge([wg1, wg2]);
      const wg_ = {weights: w, graph: g};
      expectEqual(wg, wg_);
    });
  });

  describe("overrideWeights", () => {
    const example = () => {
      const graph = new Graph().addNode(foo).addNode(bar);
      const weights = Weights.empty();
      weights.nodeWeights.set(NodeAddress.empty, 0);
      weights.nodeWeights.set(foo.address, 1);
      weights.edgeWeights.set(foobar.address, {forwards: 2, backwards: 2});
      weights.edgeWeights.set(EdgeAddress.empty, {forwards: 3, backwards: 3});
      return {graph, weights};
    };
    it("has no effect if the overrides are empty", () => {
      const g1 = example();
      const g2 = WeightedGraph.overrideWeights(g1, Weights.empty());
      expectEqual(g1, g2);
    });
    it("takes weights from base and overrides, choosing overrides on conflicts", () => {
      const overrides = Weights.empty();
      overrides.nodeWeights.set(foo.address, 101);
      overrides.nodeWeights.set(bar.address, 102);
      overrides.edgeWeights.set(foobar.address, {
        forwards: 103,
        backwards: 103,
      });
      const expected = Weights.empty();
      expected.nodeWeights.set(NodeAddress.empty, 0);
      expected.nodeWeights.set(foo.address, 101);
      expected.nodeWeights.set(bar.address, 102);
      expected.edgeWeights.set(foobar.address, {forwards: 103, backwards: 103});
      expected.edgeWeights.set(EdgeAddress.empty, {forwards: 3, backwards: 3});
      const actual = WeightedGraph.overrideWeights(example(), overrides)
        .weights;
      expect(expected).toEqual(actual);
    });
  });
});
