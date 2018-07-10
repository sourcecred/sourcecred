// @flow
import {
  type Edge,
  type EdgeAddressT,
  type NodeAddressT,
  EdgeAddress,
  NodeAddress,
} from "../../core/graph";
import type {
  Weight,
  NodeEvaluator,
  EdgeEvaluator,
} from "../../core/attribution/weights";

import * as NullUtil from "../../util/null";

export function edgeByPrefix(
  prefixes: $ReadOnlyArray<{|
    +prefix: EdgeAddressT,
    +weight: Weight,
    +directionality: number,
  |}>
): EdgeEvaluator {
  return (edge: Edge) => {
    const {weight, directionality} = NullUtil.get(
      prefixes.find(({prefix}) => EdgeAddress.hasPrefix(edge.address, prefix))
    );
    return {
      toWeight: directionality * weight,
      froWeight: (1 - directionality) * weight,
    };
  };
}

export function nodeByPrefix(
  prefixes: $ReadOnlyArray<{|
    +prefix: NodeAddressT,
    +weight: Weight,
  |}>
): NodeEvaluator {
  return (node) =>
    NullUtil.orThrow(
      prefixes.find(({prefix}) => NodeAddress.hasPrefix(node, prefix)),
      () => NodeAddress.toString(node)
    ).weight;
}
