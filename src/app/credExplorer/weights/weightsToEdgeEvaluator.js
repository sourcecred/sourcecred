// @flow

import type {Edge} from "../../../core/graph";
import type {WeightedTypes} from "./PluginWeightConfig";
import type {EdgeEvaluator} from "../../../core/attribution/pagerank";
import {NodeTrie, EdgeTrie} from "../../../core/trie";

export function weightsToEdgeEvaluator(weights: WeightedTypes): EdgeEvaluator {
  const nodeTrie = new NodeTrie();
  for (const {type, weight} of weights.nodes) {
    nodeTrie.add(type.prefix, weight);
  }
  const edgeTrie = new EdgeTrie();
  for (const {type, forwardWeight, backwardWeight} of weights.edges) {
    edgeTrie.add(type.prefix, {forwardWeight, backwardWeight});
  }

  return function evaluator(edge: Edge) {
    const srcWeight = nodeTrie.getLast(edge.src);
    const dstWeight = nodeTrie.getLast(edge.dst);
    const {forwardWeight, backwardWeight} = edgeTrie.getLast(edge.address);
    return {
      toWeight: dstWeight * forwardWeight,
      froWeight: srcWeight * backwardWeight,
    };
  };
}
