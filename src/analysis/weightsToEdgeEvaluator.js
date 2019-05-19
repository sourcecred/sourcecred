// @flow

import * as NullUtil from "../util/null";
import type {Edge, NodeAddressT} from "../core/graph";
import type {WeightedTypes, ManualWeights} from "./weights";
import type {EdgeEvaluator} from "./pagerank";
import {NodeTrie, EdgeTrie} from "../core/trie";

export function weightsToEdgeEvaluator(
  weights: WeightedTypes,
  manualWeights: ManualWeights
): EdgeEvaluator {
  const nodeTrie = new NodeTrie();
  for (const {type, weight} of weights.nodes.values()) {
    nodeTrie.add(type.prefix, weight);
  }
  const edgeTrie = new EdgeTrie();
  for (const {type, weight} of weights.edges.values()) {
    edgeTrie.add(type.prefix, weight);
  }

  function nodeWeight(n: NodeAddressT): number {
    const typeWeight = NullUtil.orElse(nodeTrie.getLast(n), 1);
    const manualWeight = NullUtil.orElse(manualWeights.get(n), 1);
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
