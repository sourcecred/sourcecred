// @flow

import * as NullUtil from "../util/null";
import type {NodeAddressT, EdgeAddressT} from "../core/graph";
import type {NodeType, EdgeType} from "./types";
import type {Weights, EdgeWeight} from "./weights";
import {NodeTrie, EdgeTrie} from "../core/trie";

export type NodeWeightEvaluator = (NodeAddressT) => number;
export type EdgeWeightEvaluator = (EdgeAddressT) => EdgeWeight;

/**
 * Given the weights and types, produces a NodeEvaluator, which assigns a weight to a
 * NodeAddressT based on its type and whether it has any manual weight specified.
 *
 * Every node address is assigned a weight based on its most specific matching
 * type (i.e. the type with the longest shared prefix). If that type has a
 * weight specified in the typeWeights map, the specified weight will be used.
 * If not, then the type's default weight is used. If no type matches a given
 * node, then it will get a default weight of 1.
 *
 * If the node address has a manual weight specified in the manualWeights map,
 * that weight will be multiplied by its type weight.
 */
export function nodeWeightEvaluator(
  types: $ReadOnlyArray<NodeType>,
  weights: Weights
): NodeWeightEvaluator {
  const {
    nodeTypeWeights: typeWeights,
    nodeManualWeights: manualWeights,
  } = weights;
  const nodeTrie = new NodeTrie();
  for (const {prefix, defaultWeight} of types) {
    const weight = NullUtil.orElse(typeWeights.get(prefix), defaultWeight);
    nodeTrie.add(prefix, weight);
  }
  return function nodeWeight(a: NodeAddressT): number {
    const typeWeight = NullUtil.orElse(nodeTrie.getLast(a), 1);
    const manualWeight = NullUtil.orElse(manualWeights.get(a), 1);
    return typeWeight * manualWeight;
  };
}

/**
 * Given the weights and types, produce an EdgeEvaluator, which assigns a toWeight and froWeight
 * to an edge address based only on its type.
 */
export function edgeWeightEvaluator(
  types: $ReadOnlyArray<EdgeType>,
  weights: Weights
): EdgeWeightEvaluator {
  const typeWeights = weights.edgeTypeWeights;
  const edgeTrie = new EdgeTrie();
  for (const {prefix, defaultWeight} of types) {
    const weight = NullUtil.orElse(typeWeights.get(prefix), defaultWeight);
    edgeTrie.add(prefix, weight);
  }
  return function evaluator(address: EdgeAddressT) {
    return NullUtil.orElse(edgeTrie.getLast(address), {
      forwards: 1,
      backwards: 1,
    });
  };
}
