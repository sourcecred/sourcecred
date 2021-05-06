// @flow

import {type NodeAddressT, NodeAddress} from "../graph";
import {type Distribution, uniformDistribution} from "./distribution";

export type Probability = number;
export type NodeDistribution = Map<NodeAddressT, Probability>;

export function distributionToNodeDistribution(
  nodeOrder: $ReadOnlyArray<NodeAddressT>,
  pi: Distribution
): NodeDistribution {
  const result = new Map();
  nodeOrder.forEach((node, i) => {
    const probability = pi[i];
    result.set(node, probability);
  });
  return result;
}

/**
 * Create a Distribution using provided node weights.
 *
 * weightedDistribution takes in a node order (as a read only array of NodeAddressT),
 * and a map providing weights for a subset of those nodes. It returns a Distribution
 * with the invariant that every node's weight is proportional to its relative weight
 * in the weights map. For example, in a case where there were three nodes and they
 * had weights of 0, 1, and 3 respectively, the distribution would be [0, 0.25, 0.75].
 *
 * If a node address is not present in the weight map, its weight is assumed to be 0.
 * If any weight is negative or non-finite, an error will be thrown.
 * If the sum of all weights is 0, then a uniform distribution will be returned.
 * If the weight map assigned weight to nodes which are not in the node order, an error
 * will be thrown.
 */
export function weightedDistribution(
  nodeOrder: $ReadOnlyArray<NodeAddressT>,
  weights: Map<NodeAddressT, number>
): Distribution {
  let totalWeight = 0;
  for (const [address, weight] of weights.entries()) {
    if (weight < 0 || !isFinite(weight)) {
      throw new Error(
        `Invalid weight ${weight} associated with address ${NodeAddress.toString(
          address
        )}`
      );
    }
    totalWeight += weight;
  }
  if (totalWeight === 0) {
    return uniformDistribution(nodeOrder.length);
  }
  let numEncounteredWeights = 0;
  const distribution = new Float64Array(nodeOrder.length);
  for (let i = 0; i < distribution.length; i++) {
    const weight = weights.get(nodeOrder[i]);
    if (weight != null) {
      numEncounteredWeights++;
      distribution[i] = weight / totalWeight;
    }
  }
  if (numEncounteredWeights !== weights.size) {
    throw new Error("weights included nodes not present in the nodeOrder");
  }
  return distribution;
}
