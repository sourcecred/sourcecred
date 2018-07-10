// @flow

import {Graph} from "../graph";
import {
  type NodeDistribution,
  distributionToNodeDistribution,
  createContributions,
  createOrderedSparseMarkovChain,
} from "./graphToMarkovChain";

import {findStationaryDistribution} from "./markovChain";
import type {EdgeEvaluator} from "./weights";

export type {NodeDistribution} from "./graphToMarkovChain";
export type PagerankOptions = {|
  +selfLoopWeight?: number,
  +verbose?: boolean,
  +convergenceThreshold?: number,
  +maxIterations?: number,
|};

function defaultOptions(): PagerankOptions {
  return {
    verbose: false,
    selfLoopWeight: 1e-3,
    convergenceThreshold: 1e-7,
    maxIterations: 255,
  };
}

export function pagerank(
  graph: Graph,
  edgeWeight: EdgeEvaluator,
  options?: PagerankOptions
): NodeDistribution {
  const fullOptions = {
    ...defaultOptions(),
    ...(options || {}),
  };
  const contributions = createContributions(
    graph,
    edgeWeight,
    fullOptions.selfLoopWeight
  );
  const osmc = createOrderedSparseMarkovChain(contributions);
  const distribution = findStationaryDistribution(osmc.chain, {
    verbose: fullOptions.verbose,
    convergenceThreshold: fullOptions.convergenceThreshold,
    maxIterations: fullOptions.maxIterations,
  });
  return distributionToNodeDistribution(osmc.nodeOrder, distribution);
}
