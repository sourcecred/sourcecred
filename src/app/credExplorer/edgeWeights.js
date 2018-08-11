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
    +weight: number,
    +directionality: number,
  |}>
): EdgeEvaluator {
  const trie = new EdgeTrie();
  for (const weightedPrefix of prefixes) {
    trie.add(weightedPrefix.prefix, weightedPrefix);
  }
  return function evaluator(edge: Edge) {
    const matchingPrefixes = trie.get(edge.address);
    const {weight, directionality} = matchingPrefixes[
      matchingPrefixes.length - 1
    ];
    return {
      toWeight: directionality * weight,
      froWeight: (1 - directionality) * weight,
    };
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
  for (const weightedPrefix of prefixes) {
    trie.add(weightedPrefix.prefix, weightedPrefix);
  }
  return function evaluator(edge: Edge) {
    const srcPrefixes = trie.get(edge.src);
    const srcDatum = srcPrefixes[srcPrefixes.length - 1];
    const dstPrefixes = trie.get(edge.dst);
    const dstDatum = dstPrefixes[dstPrefixes.length - 1];

    const baseResult = base(edge);
    return {
      toWeight: dstDatum.weight * baseResult.toWeight,
      froWeight: srcDatum.weight * baseResult.froWeight,
    };
  };
}
