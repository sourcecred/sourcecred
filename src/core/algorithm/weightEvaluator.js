// @flow

import type {NodeAddressT, EdgeAddressT} from "../graph";
import type {WeightsT, EdgeWeight, NodeWeight} from "../weights";
import {NodeTrie, EdgeTrie} from "../trie";

export type NodeWeightEvaluator = (NodeAddressT) => NodeWeight;
export type EdgeWeightEvaluator = (EdgeAddressT) => EdgeWeight;

/**
 * Given the weights and types, produce a NodeWeightEvaluator, which assigns a
 * numerical weight to any node.
 *
 * The weights are interpreted as prefixes, i.e. a given address may match
 * multiple weights. When this is the case, the matching weights are multiplied
 * together. When no weights match, a default weight of 1 is returned.
 *
 * We currently take the NodeTypes and use them to 'fill in' default type
 * weights if no weight for the type's prefix is explicitly set. This is a
 * legacy affordance; shortly we will remove the NodeTypes and require that the
 * plugins provide the type weights when the Weights object is constructed.
 */
export function nodeWeightEvaluator(weights: WeightsT): NodeWeightEvaluator {
  const nodeTrie: NodeTrie<NodeWeight> = new NodeTrie();
  for (const [prefix, weight] of weights.nodeWeights.entries()) {
    nodeTrie.add(prefix, weight);
  }
  return function nodeWeight(a: NodeAddressT): NodeWeight {
    const matchingWeights = nodeTrie.get(a);
    return matchingWeights.reduce((a, b) => a * b, 1);
  };
}

/**
 * Given the weights and the types, produce an EdgeWeightEvaluator,
 * which will assign an EdgeWeight to any edge.
 *
 * The edge weights are interpreted as prefix matchers, so a single edge may
 * match zero or more EdgeWeights. The weight for the edge will be the product
 * of all matching EdgeWeights (with 1 as the default forwards and backwards
 * weight.)
 *
 * The types are used to 'fill in' extra type weights. This is a temporary
 * state of affairs; we will change plugins to include the type weights
 * directly in the weights object, so that producing weight evaluators will no
 * longer depend on having plugin declarations on hand.
 */
export function edgeWeightEvaluator(weights: WeightsT): EdgeWeightEvaluator {
  const edgeTrie: EdgeTrie<EdgeWeight> = new EdgeTrie();
  for (const [prefix, weight] of weights.edgeWeights.entries()) {
    edgeTrie.add(prefix, weight);
  }
  return function evaluator(address: EdgeAddressT): EdgeWeight {
    const weights = edgeTrie.get(address);
    return weights.reduce(
      (a: EdgeWeight, b: EdgeWeight) => ({
        forwards: a.forwards * b.forwards,
        backwards: a.backwards * b.backwards,
      }),
      {forwards: 1, backwards: 1}
    );
  };
}
