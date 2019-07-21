// @flow

import deepFreeze from "deep-freeze";
import {NodeAddress, EdgeAddress} from "../core/graph";
import {nodeWeightEvaluator, edgeWeightEvaluator} from "./weightEvaluator";
import {defaultWeights} from "./weights";

describe("src/analysis/weightEvaluator", () => {
  describe("nodeWeightEvaluator", () => {
    const empty = NodeAddress.fromParts([]);
    const foo = NodeAddress.fromParts(["foo"]);
    const foobar = NodeAddress.fromParts(["foo", "bar"]);

    const fooNodeType = deepFreeze({
      name: "",
      pluralName: "",
      prefix: foo,
      defaultWeight: 2,
      description: "",
    });

    const fooBarNodeType = deepFreeze({
      name: "",
      pluralName: "",
      prefix: foobar,
      defaultWeight: 3,
      description: "",
    });

    const types = deepFreeze([fooNodeType, fooBarNodeType]);

    it("gives every node weight 1 with empty types and weights", () => {
      const evaluator = nodeWeightEvaluator([], defaultWeights());
      expect(evaluator(empty)).toEqual(1);
      expect(evaluator(foo)).toEqual(1);
    });
    it("matches the most specific possible node type", () => {
      const evaluator = nodeWeightEvaluator(types, defaultWeights());
      expect(evaluator(empty)).toEqual(1);
      expect(evaluator(foo)).toEqual(2);
      expect(evaluator(foobar)).toEqual(3);
    });
    it("uses type weight overrides", () => {
      const weights = defaultWeights();
      weights.nodeTypeWeights.set(foo, 3);
      weights.nodeTypeWeights.set(foobar, 4);
      const evaluator = nodeWeightEvaluator(types, weights);
      expect(evaluator(empty)).toEqual(1);
      expect(evaluator(foo)).toEqual(3);
      expect(evaluator(foobar)).toEqual(4);
    });
    it("uses manually-specified weights", () => {
      const weights = defaultWeights();
      weights.nodeManualWeights.set(foo, 3);
      const evaluator = nodeWeightEvaluator([], weights);
      expect(evaluator(empty)).toEqual(1);
      expect(evaluator(foo)).toEqual(3);
      expect(evaluator(foobar)).toEqual(1);
    });
    it("composes manual and type weights multiplicatively", () => {
      const weights = defaultWeights();
      weights.nodeManualWeights.set(foo, 3);
      const evaluator = nodeWeightEvaluator(types, weights);
      weights.nodeManualWeights.set(foo, 3);
      expect(evaluator(empty)).toEqual(1);
      expect(evaluator(foo)).toEqual(6);
      expect(evaluator(foobar)).toEqual(3);
    });
  });
  describe("edgeEvaluator", () => {
    const foo = EdgeAddress.fromParts(["foo"]);
    const foobar = EdgeAddress.fromParts(["foo", "bar"]);
    const fooType = deepFreeze({
      forwardName: "",
      backwardName: "",
      defaultWeight: {forwards: 2, backwards: 3},
      prefix: foo,
      description: "",
    });
    const fooBarType = deepFreeze({
      forwardName: "",
      backwardName: "",
      defaultWeight: {forwards: 4, backwards: 5},
      prefix: foobar,
      description: "",
    });
    it("gives default 1,1 weights if no matching type", () => {
      const evaluator = edgeWeightEvaluator([], defaultWeights());
      expect(evaluator(foo)).toEqual({forwards: 1, backwards: 1});
    });
    it("uses weights for the most specific matching type", () => {
      const evaluator = edgeWeightEvaluator(
        [fooType, fooBarType],
        defaultWeights()
      );
      expect(evaluator(foo)).toEqual({forwards: 2, backwards: 3});
      expect(evaluator(foobar)).toEqual({forwards: 4, backwards: 5});
      expect(evaluator(EdgeAddress.fromParts(["foo", "bar", "qox"]))).toEqual({
        forwards: 4,
        backwards: 5,
      });
    });
    it("uses weight overrides if available", () => {
      const weights = defaultWeights();
      weights.edgeTypeWeights.set(foo, {forwards: 99, backwards: 101});
      const evaluator = edgeWeightEvaluator([fooType, fooBarType], weights);
      expect(evaluator(foo)).toEqual({forwards: 99, backwards: 101});
      expect(evaluator(foobar)).toEqual({forwards: 4, backwards: 5});
    });
  });
});
