// @flow

import {type Edge, Graph} from "../graph";
import {
  type PagerankResult,
  distributionToPagerankResult,
  graphToOrderedSparseMarkovChain,
  type EdgeWeight,
} from "./graphToMarkovChain";

import {findStationaryDistribution} from "./markovChain";

export type {PagerankResult} from "./graphToMarkovChain";
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
  edgeWeight: (Edge) => EdgeWeight,
  options?: PagerankOptions
): PagerankResult {
  const fullOptions = {
    ...defaultOptions(),
    ...(options || {}),
  };
  const osmc = graphToOrderedSparseMarkovChain(
    graph,
    edgeWeight,
    fullOptions.selfLoopWeight
  );
  const distribution = findStationaryDistribution(osmc.chain, {
    verbose: fullOptions.verbose,
    convergenceThreshold: fullOptions.convergenceThreshold,
    maxIterations: fullOptions.maxIterations,
  });
  return distributionToPagerankResult(osmc.nodeOrder, distribution);
}
