// @flow

import {NodeAddress, EdgeAddress} from "../graph";
import {nodeWeightEvaluator, edgeWeightEvaluator} from "./weightEvaluator";
import * as Weights from "../weights";

describe("src/core/algorithm/weightEvaluator", () => {
  describe("nodeWeightEvaluator", () => {
    const empty = NodeAddress.fromParts([]);
    const foo = NodeAddress.fromParts(["foo"]);
    const foobar = NodeAddress.fromParts(["foo", "bar"]);

    it("gives every node weight 1 with empty types and weights", () => {
      const evaluator = nodeWeightEvaluator(Weights.empty());
      expect(evaluator(empty)).toEqual(1);
      expect(evaluator(foo)).toEqual(1);
    });
    it("composes matching weights multiplicatively", () => {
      const weights = Weights.empty();
      weights.nodeWeights.set(foo, 2);
      weights.nodeWeights.set(foobar, 3);
      const evaluator = nodeWeightEvaluator(weights);
      expect(evaluator(empty)).toEqual(1);
      expect(evaluator(foo)).toEqual(2);
      expect(evaluator(foobar)).toEqual(6);
    });
  });
  describe("edgeEvaluator", () => {
    const foo = EdgeAddress.fromParts(["foo"]);
    const foobar = EdgeAddress.fromParts(["foo", "bar"]);
    it("gives default 1,1 weights if no matching type", () => {
      const evaluator = edgeWeightEvaluator(Weights.empty());
      expect(evaluator(foo)).toEqual({forwards: 1, backwards: 1});
    });
    it("composes weights multiplicatively for all matching types", () => {
      const weights = Weights.empty();
      weights.edgeWeights.set(foo, {forwards: 2, backwards: 3});
      weights.edgeWeights.set(foobar, {forwards: 4, backwards: 5});
      const evaluator = edgeWeightEvaluator(weights);
      expect(evaluator(foo)).toEqual({forwards: 2, backwards: 3});
      expect(evaluator(foobar)).toEqual({forwards: 8, backwards: 15});
      expect(evaluator(EdgeAddress.fromParts(["foo", "bar", "qox"]))).toEqual({
        forwards: 8,
        backwards: 15,
      });
    });
  });
});
