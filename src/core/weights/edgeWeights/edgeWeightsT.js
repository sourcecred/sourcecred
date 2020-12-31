// @flow

import {orElse as either} from "../../../util/null";
import {type EdgeAddressT, EdgeAddress} from "../../graph";

/**
 * Represents the forwards and backwards weights for a particular Edge (or
 * edge address prefix).
 * Weight 1 is the default value and signifies normal importance.
 * Weights are linear, so 2 is twice as important as 1.
 */
export type EdgeWeight = {|+forwards: number, +backwards: number|};

export type EdgeOperator = (EdgeWeight, EdgeWeight) => EdgeWeight;

export type EdgeWeightsT = Map<EdgeAddressT, EdgeWeight>;

/** Merge multiple EdgeWeightsT together.
 *
 * The resultant EdgeWeightsT will have every weight specified by each of the input
 * weights.
 *
 * When there are overlaps (i.e. the same address is present in two or more of
 * the EdgeWeightsT), then the appropriate resolver will be invoked to resolve the
 * conflict. The resolver takes two weights and combines them to return a new
 * weight.
 *
 * When no resolvers are explicitly provided, merge defaults to
 * conservative "error on conflict" resolvers.
 */
export function merge(
  edgeWeightsT: $ReadOnlyArray<EdgeWeightsT>,
  edgeResolver?: EdgeOperator
): EdgeWeightsT {
  edgeResolver = either(edgeResolver, (_unused_a, _unused_b) => {
    throw new Error("edge weight conflict detected, but no resolver specified");
  });

  const newWeights: EdgeWeightsT = empty();
  for (const ew of edgeWeightsT) {
    for (const [addr, val] of ew.entries()) {
      const existing = newWeights.get(addr);
      if (existing == null) {
        newWeights.set(addr, val);
      } else {
        try {
          newWeights.set(addr, edgeResolver(existing, val));
        } catch (e) {
          throw new Error(
            `Error ${e} when resolving ${EdgeAddress.toString(addr)}`
          );
        }
      }
    }
  }

  return newWeights;
}

export function copy(edgeWeightsT: EdgeWeightsT): EdgeWeightsT {
  return new Map(edgeWeightsT);
}

export function empty(): EdgeWeightsT {
  return new Map();
}
