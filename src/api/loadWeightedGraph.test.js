// @flow

import {node} from "../core/graphTestUtil";
import * as WeightedGraph from "../core/weightedGraph";
import * as Weights from "../core/weights";
import {_combineGraphs} from "./loadWeightedGraph";

describe("api/loadWeightedGraph", () => {
  // The _combineGraphs subfunction does the "interesting" work here; the
  // rest is just composing IO heavy stuff (e.g. actually generating the GitHub/
  // Discourse graphs).
  describe("_combineGraphs", () => {
    const foo = node("foo");
    const bar = node("bar");
    const zod = node("zod");
    it("merges the input graphs", () => {
      const wg1 = WeightedGraph.empty();
      const wg2 = WeightedGraph.empty();
      wg1.graph.addNode(foo);
      wg1.weights.nodeWeights.set(foo.address, 3);
      wg2.graph.addNode(bar);
      wg2.weights.nodeWeights.set(bar.address, 3);
      const expected = WeightedGraph.merge([wg1, wg2]);
      expect(_combineGraphs([wg1, wg2], [], Weights.empty())).toEqual(expected);
    });
    it("uses the provided contractions", () => {
      const wg = WeightedGraph.empty();
      wg.graph.addNode(foo);
      wg.graph.addNode(bar);
      const contraction = {old: [foo.address, bar.address], replacement: zod};
      const expected = WeightedGraph.empty();
      expected.graph.addNode(zod);
      const combined = _combineGraphs([wg], [contraction], Weights.empty());
      expect(combined).toEqual(expected);
    });
    it("uses the weights as overrides", () => {
      const wg = WeightedGraph.empty();
      wg.weights.nodeWeights.set(foo.address, 3);
      wg.weights.nodeWeights.set(bar.address, 3);
      const weights = Weights.empty();
      weights.nodeWeights.set(foo.address, 5);
      weights.nodeWeights.set(zod.address, 5);
      const combined = _combineGraphs([wg], [], weights);
      const expected = WeightedGraph.empty();
      expected.weights.nodeWeights.set(bar.address, 3);
      expected.weights.nodeWeights.set(foo.address, 5);
      expected.weights.nodeWeights.set(zod.address, 5);
      expect(expected).toEqual(combined);
    });
  });
});
