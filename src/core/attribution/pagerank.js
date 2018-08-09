// @flow

import {type Edge, Graph} from "../graph";
import {
  distributionToNodeDistribution,
  createConnections,
  createOrderedSparseMarkovChain,
  type EdgeWeight,
} from "./graphToMarkovChain";
import {
  decompose,
  type PagerankNodeDecomposition,
} from "./pagerankNodeDecomposition";

import {scoreByMaximumProbability} from "./nodeScore";

import {findStationaryDistribution} from "./markovChain";

export type {NodeDistribution} from "./graphToMarkovChain";
export type {PagerankNodeDecomposition} from "./pagerankNodeDecomposition";
export type PagerankOptions = {|
  +selfLoopWeight?: number,
  +verbose?: boolean,
  +convergenceThreshold?: number,
  +maxIterations?: number,
  // Scores will be normalized so that `maxScore` is the highest score
  +maxScore?: number,
|};

export type {EdgeWeight} from "./graphToMarkovChain";
export type EdgeEvaluator = (Edge) => EdgeWeight;

function defaultOptions(): PagerankOptions {
  return {
    verbose: false,
    selfLoopWeight: 1e-3,
    convergenceThreshold: 1e-7,
    maxIterations: 255,
    maxScore: 1000,
  };
}

export async function pagerank(
  graph: Graph,
  edgeWeight: EdgeEvaluator,
  options?: PagerankOptions
): Promise<PagerankNodeDecomposition> {
  const fullOptions = {
    ...defaultOptions(),
    ...(options || {}),
  };
  const connections = createConnections(
    graph,
    edgeWeight,
    fullOptions.selfLoopWeight
  );
  const osmc = createOrderedSparseMarkovChain(connections);
  const distribution = await findStationaryDistribution(osmc.chain, {
    verbose: fullOptions.verbose,
    convergenceThreshold: fullOptions.convergenceThreshold,
    maxIterations: fullOptions.maxIterations,
    yieldAfterMs: 30,
  });
  const pi = distributionToNodeDistribution(osmc.nodeOrder, distribution);
  const scores = scoreByMaximumProbability(pi, fullOptions.maxScore);
  return decompose(scores, connections);
}
