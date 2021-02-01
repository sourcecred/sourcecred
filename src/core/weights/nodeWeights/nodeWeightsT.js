// @flow

import {orElse as either} from "../../../util/null";
import {type NodeAddressT, NodeAddress} from "../../graph";

/**
 * Represents the weight for a particular Node (or node address prefix).
 * Weight 1 is the default value and signifies normal importance.
 * Weights are linear, so 2 is twice as important as 1.
 */
export type NodeWeight = number;

export type NodeOperator = (NodeWeight, NodeWeight) => NodeWeight;

export type NodeWeightsT = Map<NodeAddressT, NodeWeight>;

/** Merge multiple NodeWeightsT together.
 *
 * The resultant NodeWeightsT will have every weight specified by each of the input
 * weights.
 *
 * When there are overlaps (i.e. the same address is present in two or more of
 * the NodeWeightsT), then the appropriate resolver will be invoked to resolve the
 * conflict. The resolver takes two weights and combines them to return a new
 * weight.
 *
 * When no resolvers are explicitly provided, merge defaults to
 * conservative "error on conflict" resolvers.
 */
export function merge(
  nodeWeightsTs: $ReadOnlyArray<NodeWeightsT>,
  nodeResolver?: NodeOperator
): NodeWeightsT {
  nodeResolver = either(nodeResolver, (_unused_a, _unused_b) => {
    throw new Error("node weight conflict detected, but no resolver specified");
  });

  // throwing on the first Weights we added, which is empty...
  const newWeights: NodeWeightsT = empty();
  for (const nw of nodeWeightsTs) {
    if (!nw) {
      throw new Error(`NodeWeightT Undefined`);
    }
    for (const [addr, val] of nw.entries()) {
      const existing = newWeights.get(addr);
      if (existing == null) {
        newWeights.set(addr, val);
      } else {
        try {
          newWeights.set(addr, nodeResolver(existing, val));
        } catch (e) {
          throw new Error(`${e} when resolving ${NodeAddress.toString(addr)}`);
        }
      }
    }
  }

  return newWeights;
}

export function copy(nodeWeightsT: NodeWeightsT): NodeWeightsT {
  return new Map(nodeWeightsT);
}

export function empty(): NodeWeightsT {
  return new Map();
}
