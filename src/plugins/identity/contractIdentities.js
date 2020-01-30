// @flow

import * as Weights from "../../core/weights";
import {type WeightedGraph as WeightedGraphT} from "../../core/weightedGraph";
import {type NodeContraction, NodeAddress} from "../../core/graph";
import {nodeContractions} from "./nodeContractions";
import {type IdentitySpec} from "./identity";

/**
 * Applies nodeContractions to a WeightedGraph.
 *
 * This functionality is defined as part of the identity plugin rather than as
 * a feature of WeightedGraph because it doesn't attempt to contract weights
 * (it's not clear how to do this in a general principled way). Within the
 * identity plugin, we do not expect user identities to have weights
 * associated, so we can contract the graph without attempting to contract the
 * weights.
 *
 * As a safety measure, this method will error if any of the node addresses
 * being contracted has an explicitly set weight. It will not error if there
 * are matching type weights, so that it is still possible (e.g.) to apply
 * a weighting to an entire plugin.
 *
 * For more context on this decision, see discussion in #1591.
 */
export function _contractWeightedGraph(
  wg: WeightedGraphT,
  contractions: $ReadOnlyArray<NodeContraction>
): WeightedGraphT {
  const {graph, weights} = wg;
  for (const {old} of contractions) {
    for (const address of old) {
      const weight = weights.nodeWeights.get(address) || 0;
      if (weight !== 0) {
        throw new Error(
          `Explicit weight ${weight} on contracted node ${NodeAddress.toString(
            address
          )}`
        );
      }
    }
  }
  return {
    graph: graph.contractNodes(contractions),
    weights: Weights.copy(weights),
  };
}

/**
 * Given a WeightedGraph and identity information, produce a contracted
 * WeightedGraph where all of an identitiy's aliases have been contracted into
 * a unified identity.
 *
 * An error will be thrown if any of the aliases had an explicitly set weight,
 * since we don't currently support weight contraction.
 *
 * Note: This function has no unit tests, because it is a trivial composition
 * of two tested functions. Thus, flow typechecking in sufficient. If adding
 * any complexity to this function, please also add tests.
 */
export function contractIdentities(
  wg: WeightedGraphT,
  identitySpec: IdentitySpec
): WeightedGraphT {
  return _contractWeightedGraph(wg, nodeContractions(identitySpec));
}
