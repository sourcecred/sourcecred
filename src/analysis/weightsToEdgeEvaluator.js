// @flow

import type {Edge} from "../core/graph";
import type {WeightsT} from "../core/weights";
import type {EdgeEvaluator} from "./pagerank";
import {
  nodeWeightEvaluator,
  edgeWeightEvaluator,
} from "../core/algorithm/weightEvaluator";

/**
 * Given the weight choices and the node and edge types, produces an edge
 * evaluator.
 *
 * The edge evaluator will give a forwards and backwards weight to every edge
 * in the graph according to the provided weights. When multiple weights apply
 * (e.g. a nodeType weight, an edgeType weight, and a manual nodeWeight all
 * affecting the same edge), they are composed multiplicatively.
 *
 * When multiple node or edge types may match a given node or edge, only
 * weights for the most specific type are considered (i.e. the type with the
 * longest prefix).
 *
 * The node and edge types are required so that we know what the default weights
 * are for types whose weights are not manually specified.
 *
 * NOTE: This method is deprecated. Going forward, we should use node weights
 * as a direct input of their own (e.g. as a seed vector and for determining
 * cred weighting) rather than as a component of the edge weight. This method
 * will be removed when the 'legacy cred' UI is removed.
 */
export function weightsToEdgeEvaluator(weights: WeightsT): EdgeEvaluator {
  const nodeWeight = nodeWeightEvaluator(weights);
  const edgeWeight = edgeWeightEvaluator(weights);

  return function evaluator(edge: Edge) {
    const srcWeight = nodeWeight(edge.src);
    const dstWeight = nodeWeight(edge.dst);
    const {forwards, backwards} = edgeWeight(edge.address);
    return {
      forwards: dstWeight * forwards,
      backwards: srcWeight * backwards,
    };
  };
}
