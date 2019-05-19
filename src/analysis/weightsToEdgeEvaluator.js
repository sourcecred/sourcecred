// @flow

import * as NullUtil from "../util/null";
import type {Edge, NodeAddressT} from "../core/graph";
import type {NodeAndEdgeTypes} from "./types";
import type {Weights} from "./weights";
import type {EdgeEvaluator} from "./pagerank";
import {NodeTrie, EdgeTrie} from "../core/trie";

/**
 * Given the weight choices and the node and edge types, produces an edge
 * evaluator.
 *
 * The edge evaluator will give a toWeight and froWeight to every edge in the
 * graph according to the provided weights. When multiple weights apply (e.g. a
 * nodeType weight, an edgeType weight, and a manual nodeWeight all affecting
 * the same edge), they are composed multiplicatively.
 *
 * When multiple node or edge types may match a given node or edge, only
 * weights for the most specific type are considered (i.e. the type with the
 * longest prefix).
 *
 * The node and edge types are required so that we know what the default weights
 * are for types whose weights are not manually specified.
 */
export function weightsToEdgeEvaluator(
  weights: Weights,
  types: NodeAndEdgeTypes
): EdgeEvaluator {
  const {nodeTypeWeights, edgeTypeWeights, nodeManualWeights} = weights;
  const nodeTrie = new NodeTrie();
  for (const {prefix, defaultWeight} of types.nodeTypes) {
    const weight = NullUtil.orElse(nodeTypeWeights.get(prefix), defaultWeight);
    nodeTrie.add(prefix, weight);
  }
  const edgeTrie = new EdgeTrie();
  for (const {prefix, defaultWeight} of types.edgeTypes) {
    const weight = NullUtil.orElse(edgeTypeWeights.get(prefix), defaultWeight);
    edgeTrie.add(prefix, weight);
  }

  function nodeWeight(n: NodeAddressT): number {
    const typeWeight = NullUtil.orElse(nodeTrie.getLast(n), 1);
    const manualWeight = NullUtil.orElse(nodeManualWeights.get(n), 1);
    return typeWeight * manualWeight;
  }

  return function evaluator(edge: Edge) {
    const srcWeight = nodeWeight(edge.src);
    const dstWeight = nodeWeight(edge.dst);
    const edgeWeight = NullUtil.orElse(edgeTrie.getLast(edge.address), {
      forwards: 1,
      backwards: 1,
    });
    const {forwards, backwards} = edgeWeight;
    return {
      toWeight: dstWeight * forwards,
      froWeight: srcWeight * backwards,
    };
  };
}
