// @flow

import {NodeAddress, EdgeAddress} from "../core/graph";
import {type Weights, defaultWeights} from "./weights";
import {weightsToEdgeEvaluator} from "./weightsToEdgeEvaluator";

describe("analysis/weightsToEdgeEvaluator", () => {
  const src = NodeAddress.fromParts(["src"]);
  const dst = NodeAddress.fromParts(["dst"]);
  const edge = {src, dst, address: EdgeAddress.fromParts(["edge"])};

  const fallbackNodeType = Object.freeze({
    name: "",
    pluralName: "",
    prefix: NodeAddress.empty,
    defaultWeight: 1,
    description: "",
  });

  const srcNodeType = Object.freeze({
    name: "",
    pluralName: "",
    prefix: src,
    defaultWeight: 2,
    description: "",
  });

  const fallbackEdgeType = Object.freeze({
    forwardName: "",
    backwardName: "",
    defaultWeight: Object.freeze({forwards: 1, backwards: 1}),
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
    expect(evaluateEdge(defaultWeights())).toEqual({toWeight: 1, froWeight: 2});
  });

  it("only matches the most specific node types", () => {
    const weights = defaultWeights();
    weights.nodeTypeWeights.set(NodeAddress.empty, 99);
    expect(evaluateEdge(weights)).toEqual({toWeight: 99, froWeight: 2});
  });

  it("takes manually specified edge type weights into account", () => {
    const weights = defaultWeights();
    // Note that here we grab the fallout edge type. This also verifies that
    // we are doing prefix matching on the types (rather than exact matching).
    weights.edgeTypeWeights.set(EdgeAddress.empty, {
      forwards: 6,
      backwards: 12,
    });
    expect(evaluateEdge(weights)).toEqual({toWeight: 6, froWeight: 24});
  });

  it("takes manually specified per-node weights into account", () => {
    const weights = defaultWeights();
    weights.nodeManualWeights.set(src, 10);
    expect(evaluateEdge(weights)).toEqual({toWeight: 1, froWeight: 20});
  });

  it("uses 1 as a default weight for unmatched nodes and edges", () => {
    const evaluator = weightsToEdgeEvaluator(defaultWeights(), {
      nodeTypes: [],
      edgeTypes: [],
    });
    expect(evaluator(edge)).toEqual({toWeight: 1, froWeight: 1});
  });

  it("ignores extra weights if they do not apply", () => {
    const withoutExtraWeights = evaluateEdge(defaultWeights());
    const extraWeights = defaultWeights();
    extraWeights.nodeManualWeights.set(NodeAddress.fromParts(["foo"]), 99);
    extraWeights.nodeTypeWeights.set(NodeAddress.fromParts(["foo"]), 99);
    extraWeights.edgeTypeWeights.set(EdgeAddress.fromParts(["foo"]), {
      forwards: 14,
      backwards: 19,
    });
    const withExtraWeights = evaluateEdge(extraWeights);
    expect(withoutExtraWeights).toEqual(withExtraWeights);
  });
});
