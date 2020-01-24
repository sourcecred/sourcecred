// @flow

import * as Weights from "./weights";
import {Graph} from "./graph";
import * as WeightedGraph from "./weightedGraph";
import * as GraphTest from "./graphTestUtil";

describe("core/weightedGraph", () => {
  function expectEqual(wg1, wg2) {
    expect(wg1.graph.equals(wg2.graph)).toBe(true);
    expect(wg1.weights).toEqual(wg2.weights);
  }

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
      const n1 = GraphTest.node("foo");
      const n2 = GraphTest.node("bar");
      const g1 = new Graph().addNode(n1);
      const g2 = new Graph().addNode(n2);
      const w1 = Weights.empty();
      w1.nodeWeights.set(n1.address, 1);
      const w2 = Weights.empty();
      w2.nodeWeights.set(n2.address, 2);
      const wg1 = {graph: g1, weights: w1};
      const wg2 = {graph: g2, weights: w2};
      const g = Graph.merge([g1, g2]);
      const w = Weights.merge([w1, w2]);
      const wg = WeightedGraph.merge([wg1, wg2]);
      const wg_ = {weights: w, graph: g};
      expectEqual(wg, wg_);
    });
  });
  describe("contractNodes", () => {
    it("contracts the graph without contracting any weights", () => {
      const a = GraphTest.node("a");
      const b = GraphTest.node("b");
      const graph = new Graph().addNode(a).addNode(b);
      const weights = Weights.empty();
      weights.nodeWeights.set(a.address, 3);
      weights.nodeWeights.set(b.address, 4);
      const graph_ = graph.copy();
      const weights_ = Weights.copy(weights);
      const wg = {graph, weights};
      const contractions = [{old: [a.address], replacement: b}];
      const wgContracted = WeightedGraph.contractNodes(wg, contractions);
      const graphContracted = graph.contractNodes(contractions);

      // Verify originals were not mutated
      expect(graph.equals(graph_)).toBe(true);
      expect(weights).toEqual(weights_);

      // Verify the graph was contracted properly
      const expectedWG = {graph: graphContracted, weights};
      expectEqual(expectedWG, wgContracted);
    });
  });
});
