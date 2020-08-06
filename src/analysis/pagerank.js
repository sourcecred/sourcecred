// @flow

import {type Edge, Graph, NodeAddress, type NodeAddressT} from "../core/graph";
import {
  distributionToNodeDistribution,
  createConnections,
  createOrderedSparseMarkovChain,
  type EdgeWeight,
} from "../core/algorithm/graphToMarkovChain";
import {
  decompose,
  type PagerankNodeDecomposition,
} from "./pagerankNodeDecomposition";

import {scoreByConstantTotal} from "./nodeScore";

import {
  findStationaryDistribution,
  type PagerankParams,
  type PagerankOptions as CorePagerankOptions,
} from "../core/algorithm/markovChain";
import {uniformDistribution} from "../core/algorithm/distribution";
import * as N from "../util/numerics";

export type {NodeDistribution} from "../core/algorithm/nodeDistribution";
export type {PagerankNodeDecomposition} from "./pagerankNodeDecomposition";
export type FullPagerankOptions = {|
  +selfLoopWeight: N.FiniteNonnegative,
  +verbose: boolean,
  +convergenceThreshold: N.FiniteNonnegative,
  +maxIterations: N.NonnegativeInteger,
  // Scores will be normalized so that scores sum to totalScore
  +totalScore: N.FiniteNonnegative,
  // Only nodes matching this prefix will count for normalization
  +totalScoreNodePrefix: NodeAddressT,
|};
export type PagerankOptions = $Shape<FullPagerankOptions>;

export type {EdgeWeight} from "../core/algorithm/graphToMarkovChain";
export type EdgeEvaluator = (Edge) => EdgeWeight;

export const DEFAULT_SYNTHETIC_LOOP_WEIGHT = N.finiteNonnegative(1e-3);
export const DEFAULT_MAX_ITERATIONS = N.nonnegativeInteger(255);
export const DEFAULT_CONVERGENCE_THRESHOLD = N.finiteNonnegative(1e-7);

function defaultOptions(): PagerankOptions {
  return {
    verbose: false,
    selfLoopWeight: DEFAULT_SYNTHETIC_LOOP_WEIGHT,
    convergenceThreshold: DEFAULT_CONVERGENCE_THRESHOLD,
    maxIterations: DEFAULT_MAX_ITERATIONS,
    totalScore: N.finiteNonnegative(1000),
    totalScoreNodePrefix: NodeAddress.empty,
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
  const params: PagerankParams = {
    chain: osmc.chain,
    alpha: N.proportion(0),
    pi0: uniformDistribution(osmc.chain.length),
    seed: uniformDistribution(osmc.chain.length),
  };
  const coreOptions: CorePagerankOptions = {
    verbose: fullOptions.verbose,
    convergenceThreshold: fullOptions.convergenceThreshold,
    maxIterations: fullOptions.maxIterations,
    yieldAfterMs: N.finiteNonnegative(30),
  };
  const distributionResult = await findStationaryDistribution(
    params,
    coreOptions
  );
  const pi = distributionToNodeDistribution(
    osmc.nodeOrder,
    distributionResult.pi
  );
  const scores = scoreByConstantTotal(
    pi,
    fullOptions.totalScore,
    fullOptions.totalScoreNodePrefix
  );
  return decompose(scores, connections);
}
