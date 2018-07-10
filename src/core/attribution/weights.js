// @flow

import {type Edge, type NodeAddressT} from "../graph";
// Weights are interpreted as base-2 logarithmic relative values
// weight 0 = baseline
// weight 1 = 2x as important as baseline
// weight -1 = 1/2 as important as baseline
export type Weight = number;
export type EdgeWeight = {|
  +toWeight: number, // weight from src to dst
  +froWeight: number, // weight from dst to src
|};
export type NodeEvaluator = (NodeAddressT) => Weight;
export type EdgeEvaluator = (Edge) => EdgeWeight;

// Semantics TBD
export function composeNodeEvaluators(
  n1: NodeEvaluator,
  n2: NodeEvaluator
): NodeEvaluator {
  return (n) => {
    // Placeholder - we do not believe these are the right semantics
    return n1(n) + n2(n);
  };
}

// Semantics TBD
export function composeEdgeEvaluators(
  e1: EdgeEvaluator,
  e2: EdgeEvaluator
): EdgeEvaluator {
  return (e) => {
    // Placeholder - we do not believe these are the right semantics
    const r1 = e1(e);
    const r2 = e2(e);
    return {
      toWeight: r1.toWeight + r2.toWeight,
      froWeight: r1.froWeight + r2.froWeight,
    };
  };
}

export function liftNodeEvaluator(
  n: NodeEvaluator,
  e: EdgeEvaluator
): EdgeEvaluator {
  return (edge) => {
    const {toWeight, froWeight} = e(edge);
    return {
      toWeight: toWeight * n(edge.dst),
      froWeight: froWeight * n(edge.src),
    };
  };
}
