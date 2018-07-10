// @flow
import {
  type Edge,
  type EdgeAddressT,
  type NodeAddressT,
  EdgeAddress,
  NodeAddress,
} from "../../core/graph";
import type {EdgeEvaluator} from "../../core/attribution/pagerank";

import * as NullUtil from "../../util/null";

export function byEdgeType(
  prefixes: $ReadOnlyArray<{|
    +prefix: EdgeAddressT,
    +weight: number,
    +directionality: number,
  |}>
): EdgeEvaluator {
  return function evaluator(edge: Edge) {
    const {weight, directionality} = NullUtil.get(
      prefixes.find(({prefix}) => EdgeAddress.hasPrefix(edge.address, prefix))
    );
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
  return function evaluator(edge: Edge) {
    const srcDatum = prefixes.find(({prefix}) =>
      NodeAddress.hasPrefix(edge.src, prefix)
    );
    const dstDatum = prefixes.find(({prefix}) =>
      NodeAddress.hasPrefix(edge.dst, prefix)
    );
    if (srcDatum == null || dstDatum == null) {
      throw new Error(EdgeAddress.toString(edge.address));
    }
    const baseResult = base(edge);
    return {
      toWeight: dstDatum.weight * baseResult.toWeight,
      froWeight: srcDatum.weight * baseResult.froWeight,
    };
  };
}
