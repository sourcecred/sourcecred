// @flow

import * as MapUtil from "../util/map";
import {type Edge, Graph, NodeAddress, type NodeAddressT} from "../core/graph";
import {type WeightedGraph} from "../core/weightedGraph";
import {MarkovProcessGraph} from "../core/markovProcessGraph";
import {
  distributionToNodeDistribution,
  createConnections,
  createOrderedSparseMarkovChain,
  type EdgeWeight,
  type Connection,
  type Adjacency,
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

export type {NodeDistribution} from "../core/algorithm/nodeDistribution";
export type {PagerankNodeDecomposition} from "./pagerankNodeDecomposition";
export type FullPagerankOptions = {|
  +selfLoopWeight: number,
  +verbose: boolean,
  +convergenceThreshold: number,
  +maxIterations: number,
  // Scores will be normalized so that scores sum to totalScore
  +totalScore: number,
  // Only nodes matching this prefix will count for normalization
  +totalScoreNodePrefix: NodeAddressT,
|};
export type PagerankOptions = $Shape<FullPagerankOptions>;

export type {EdgeWeight} from "../core/algorithm/graphToMarkovChain";
export type EdgeEvaluator = (Edge) => EdgeWeight;

export const DEFAULT_SYNTHETIC_LOOP_WEIGHT = 1e-3;
export const DEFAULT_MAX_ITERATIONS = 255;
export const DEFAULT_CONVERGENCE_THRESHOLD = 1e-7;

function defaultOptions(): PagerankOptions {
  return {
    verbose: false,
    selfLoopWeight: DEFAULT_SYNTHETIC_LOOP_WEIGHT,
    convergenceThreshold: DEFAULT_CONVERGENCE_THRESHOLD,
    maxIterations: DEFAULT_MAX_ITERATIONS,
    totalScore: 1000,
    totalScoreNodePrefix: NodeAddress.empty,
  };
}

export async function pagerank(
  wg: WeightedGraph,
  options?: PagerankOptions
): Promise<PagerankNodeDecomposition> {
  const fullOptions = {
    ...defaultOptions(),
    ...(options || {}),
  };
  const timeBoundaries = Array(52)
    .fill()
    .map((_, i) => (1580603309 - 86400 * 7 * (i + 1)) * 1000);
  const fibration = {
    what: [NodeAddress.fromParts(["sourcecred", "github", "USERLIKE", "USER"])],
    beta: 0.5,
    gammaForward: 0.1,
    gammaBackward: 0.1,
  };
  const seed = {alpha: 0.1};
  const mpg = MarkovProcessGraph.new(wg, fibration, seed);
  const osmc = mpg.toMarkovChain();
  const params: PagerankParams = {
    chain: osmc.chain,
    alpha: 0,
    pi0: uniformDistribution(osmc.chain.length),
    seed: uniformDistribution(osmc.chain.length),
  };
  const coreOptions: CorePagerankOptions = {
    verbose: fullOptions.verbose,
    convergenceThreshold: fullOptions.convergenceThreshold,
    maxIterations: fullOptions.maxIterations,
    yieldAfterMs: 30,
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
  const nodeToConnections: Map<
    NodeAddressT,
    $ReadOnlyArray<Connection>
  > = new Map();
  const markovEdges = mpg._edges.values();
  for (const me of markovEdges) {
    const noflip = !me.reversed;
    const src = noflip ? me.src : me.dst;
    const dst = noflip ? me.dst : me.src;
    const edge: Edge = {address: me.address, src, dst, timestampMs: 0};
    const adjacency: Adjacency = noflip
      ? {type: "OUT_EDGE", edge}
      : {type: "IN_EDGE", edge};
    const connection: Connection = {
      adjacency,
      weight: me.transitionProbability,
    };
    MapUtil.pushValue((nodeToConnections: any), me.dst, connection);
  }
  return decompose(scores, nodeToConnections);
}
