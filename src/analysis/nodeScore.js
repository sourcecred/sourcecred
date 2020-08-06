// @flow

import {NodeAddress, type NodeAddressT} from "../core/graph";
import type {NodeDistribution} from "../core/algorithm/nodeDistribution";
import * as N from "../util/numerics";

export type NodeScore = Map<NodeAddressT, number>;

/* Normalize scores so that the maximum score has a fixed value */
export function scoreByMaximumProbability(
  pi: NodeDistribution,
  maxScore: N.FiniteNonnegative
): NodeScore {
  // Redundant with type signature, left in to make a safer refactor PR.
  if (maxScore <= 0) {
    throw new Error("Invalid argument: maxScore must be >= 0");
  }
  let maxProbability = 0;
  for (const p of pi.values()) {
    maxProbability = Math.max(p, maxProbability);
  }
  if (maxProbability <= 0) {
    throw new Error("Invariant violation: maxProbability must be >= 0");
  }
  const multiFactor = maxScore / maxProbability;
  const scoreMap = new Map();
  for (const [addr, prob] of pi) {
    scoreMap.set(addr, prob * multiFactor);
  }
  return scoreMap;
}

/* Normalize scores so that a group of nodes have a fixed total score */
export function scoreByConstantTotal(
  pi: NodeDistribution,
  totalScore: N.FiniteNonnegative,
  nodeFilter: NodeAddressT /* Normalizes based on nodes matching this prefix */
): NodeScore {
  if (totalScore <= 0) {
    throw new Error("Invalid argument: totalScore must be >= 0");
  }

  let unnormalizedTotal = 0;
  for (const [addr, prob] of pi) {
    if (NodeAddress.hasPrefix(addr, nodeFilter)) {
      unnormalizedTotal += prob;
    }
  }
  if (unnormalizedTotal === 0) {
    throw new Error(
      "Tried to normalize based on nodes with no score. " +
        "This probably means that there were no nodes matching prefix: " +
        NodeAddress.toString(nodeFilter)
    );
  }
  const f = totalScore / unnormalizedTotal;
  const scoreMap = new Map();
  for (const [addr, prob] of pi) {
    scoreMap.set(addr, prob * f);
  }
  return scoreMap;
}
