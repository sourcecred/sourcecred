// @flow

import type {NodeAddressT} from "../graph";
import type {NodeDistribution} from "./graphToMarkovChain";

export type NodeScore = Map<NodeAddressT, number>;

export function scoreByMaximumProbability(
  pi: NodeDistribution,
  maxScore: number
): NodeScore {
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
