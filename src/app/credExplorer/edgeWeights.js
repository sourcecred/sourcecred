// @flow
import {
  type Edge,
  type EdgeAddressT,
  type NodeAddressT,
} from "../../core/graph";
import {NodeTrie, EdgeTrie} from "../../core/trie";
import type {EdgeEvaluator} from "../../core/attribution/pagerank";

export function byEdgeType(
  prefixes: $ReadOnlyArray<{|
    +prefix: EdgeAddressT,
    +forwardWeight: number,
    +backwardWeight: number,
  |}>
): EdgeEvaluator {
  const trie = new EdgeTrie();
  for (const {prefix, forwardWeight, backwardWeight} of prefixes) {
    trie.add(prefix, {toWeight: forwardWeight, froWeight: backwardWeight});
  }
  return function evaluator(edge: Edge) {
    return trie.getLast(edge.address);
  };
}

export function byNodeType(
  base: EdgeEvaluator,
  prefixes: $ReadOnlyArray<{|
    +prefix: NodeAddressT,
    +weight: number,
  |}>
): EdgeEvaluator {
  const trie = new NodeTrie();
  for (const {weight, prefix} of prefixes) {
    trie.add(prefix, weight);
  }
  return function evaluator(edge: Edge) {
    const srcWeight = trie.getLast(edge.src);
    const dstWeight = trie.getLast(edge.dst);

    const baseResult = base(edge);
    return {
      toWeight: dstWeight * baseResult.toWeight,
      froWeight: srcWeight * baseResult.froWeight,
    };
  };
}
