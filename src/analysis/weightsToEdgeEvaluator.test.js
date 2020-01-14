// @flow

import deepFreeze from "deep-freeze";
import {NodeAddress, EdgeAddress} from "../core/graph";
import {type Weights, defaultWeights} from "./weights";
import {weightsToEdgeEvaluator} from "./weightsToEdgeEvaluator";

describe("analysis/weightsToEdgeEvaluator", () => {
  const src = NodeAddress.fromParts(["src"]);
  const dst = NodeAddress.fromParts(["dst"]);
  const edge = {
    src,
    dst,
    address: EdgeAddress.fromParts(["edge"]),
    timestampMs: 0,
  };

  const fallbackNodeType = deepFreeze({
    name: "",
    pluralName: "",
    prefix: NodeAddress.empty,
    defaultWeight: 1,
    description: "",
  });

  const srcNodeType = deepFreeze({
    name: "",
    pluralName: "",
    prefix: src,
    defaultWeight: 2,
    description: "",
  });

  const fallbackEdgeType = deepFreeze({
    forwardName: "",
    backwardName: "",
    defaultWeight: {forwards: 1, backwards: 1},
    prefix: EdgeAddress.empty,
    description: "",
  });

  function evaluateEdge(weights: Weights) {
    const evaluator = weightsToEdgeEvaluator(weights, {
      nodeTypes: [fallbackNodeType, srcNodeType],
      edgeTypes: [fallbackEdgeType],
    });
    return evaluator(edge);
  }

  it("applies default weights when none are specified", () => {
    expect(evaluateEdge(defaultWeights())).toEqual({forwards: 1, backwards: 2});
  });

  it("matches all prefixes of the nodes in scope", () => {
    const weights = defaultWeights();
    weights.nodeWeights.set(NodeAddress.empty, 99);
    expect(evaluateEdge(weights)).toEqual({forwards: 99, backwards: 2 * 99});
  });

  it("takes manually specified edge type weights into account", () => {
    const weights = defaultWeights();
    // Note that here we grab the fallout edge type. This also verifies that
    // we are doing prefix matching on the types (rather than exact matching).
    weights.edgeWeights.set(EdgeAddress.empty, {
      forwards: 6,
      backwards: 12,
    });
    expect(evaluateEdge(weights)).toEqual({forwards: 6, backwards: 24});
  });

  it("an explicit weight on a prefix overrides the type weight", () => {
    const weights = defaultWeights();
    weights.nodeWeights.set(src, 1);
    expect(evaluateEdge(weights)).toEqual({forwards: 1, backwards: 1});
  });

  it("uses 1 as a default weight for unmatched nodes and edges", () => {
    const evaluator = weightsToEdgeEvaluator(defaultWeights(), {
      nodeTypes: [],
      edgeTypes: [],
    });
    expect(evaluator(edge)).toEqual({forwards: 1, backwards: 1});
  });

  it("ignores extra weights if they do not apply", () => {
    const withoutExtraWeights = evaluateEdge(defaultWeights());
    const extraWeights = defaultWeights();
    extraWeights.nodeWeights.set(NodeAddress.fromParts(["foo"]), 99);
    extraWeights.nodeWeights.set(NodeAddress.fromParts(["foo"]), 99);
    extraWeights.edgeWeights.set(EdgeAddress.fromParts(["foo"]), {
      forwards: 14,
      backwards: 19,
    });
    const withExtraWeights = evaluateEdge(extraWeights);
    expect(withoutExtraWeights).toEqual(withExtraWeights);
  });
});
