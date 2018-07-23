// @flow

import {type Edge, Graph} from "../graph";
import {
  distributionToNodeDistribution,
  createContributions,
  createOrderedSparseMarkovChain,
  type EdgeWeight,
} from "./graphToMarkovChain";
import {
  decompose,
  type PagerankNodeDecomposition,
} from "./pagerankNodeDecomposition";

import {findStationaryDistribution} from "./markovChain";

export type {NodeDistribution} from "./graphToMarkovChain";
export type {PagerankNodeDecomposition} from "./pagerankNodeDecomposition";
export type PagerankOptions = {|
  +selfLoopWeight?: number,
  +verbose?: boolean,
  +convergenceThreshold?: number,
  +maxIterations?: number,
|};

export type {EdgeWeight} from "./graphToMarkovChain";
export type EdgeEvaluator = (Edge) => EdgeWeight;

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
): PagerankNodeDecomposition {
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
  const pi = distributionToNodeDistribution(osmc.nodeOrder, distribution);
  return decompose(pi, contributions);
}
