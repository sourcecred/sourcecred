// @flow

import deepFreeze from "deep-freeze";
import {sum} from "d3-array";
import * as NullUtil from "../../util/null";
import {
  Graph,
  type NodeAddressT,
  type Edge,
  type Node,
  NodeAddress,
} from "../graph";
import * as WeightedGraph from "../weightedGraph";
import {type WeightedGraph as WeightedGraphT} from "../weightedGraph";
import {type Interval, partitionGraph} from "../interval";
import {
  nodeWeightEvaluator,
  edgeWeightEvaluator,
  type NodeWeightEvaluator,
  type EdgeWeightEvaluator,
} from "./weightEvaluator";
import {weightedDistribution} from "./nodeDistribution";
import {type Distribution} from "./distribution";
import {
  createOrderedSparseMarkovChain,
  createConnections,
  distributionToNodeDistribution,
} from "./graphToMarkovChain";
import {
  findStationaryDistribution,
  type PagerankParams,
  type SparseMarkovChain,
  type PagerankOptions as CorePagerankOptions,
} from "./markovChain";

export type PagerankOptions = {|
  +maxIterations: number,
  +convergenceThreshold: number,
  +alpha: number,
|};

const DEFAULT_MAX_ITERATIONS = 255;
const DEFAULT_CONVERGENCE_THRESHOLD = 1e-7;
const DEFAULT_ALPHA = 0.05;

export function defaultOptions(
  overrides?: $Shape<PagerankOptions>
): PagerankOptions {
  const defaults = {
    maxIterations: DEFAULT_MAX_ITERATIONS,
    convergenceThreshold: DEFAULT_CONVERGENCE_THRESHOLD,
    alpha: DEFAULT_ALPHA,
  };
  return {...defaults, ...overrides};
}

export async function pagerank(
  wg: WeightedGraphT,
  scoringPrefixes: $ReadOnlyArray<NodeAddressT>,
  options: PagerankOptions
): Promise<Map<NodeAddressT, number>> {
  const nodeEvaluator = nodeWeightEvaluator(wg.weights);
  const edgeEvaluator = edgeWeightEvaluator(wg.weights);
  const oldStyleEvaluator = (e: Edge) => edgeEvaluator(e.address);
  const connections = createConnections(wg.graph, oldStyleEvaluator, 0);
  const nodeOrder = wg.graph._getOrder().nodeOrder;
  const osmc = createOrderedSparseMarkovChain(connections);
  const nodeWeights = new Map();
  for (const addr of nodeOrder) {
    nodeWeights.set(addr, nodeEvaluator(addr));
  }
  const seed = weightedDistribution(nodeOrder, nodeWeights);
  const params: PagerankParams = {
    chain: osmc.chain,
    alpha: options.alpha,
    pi0: seed,
    seed,
  };
  const coreOptions: CorePagerankOptions = {
    verbose: true,
    convergenceThreshold: options.convergenceThreshold,
    maxIterations: options.maxIterations,
    yieldAfterMs: 30,
  };
  const distributionResult = await findStationaryDistribution(
    params,
    coreOptions
  );
  const pi = distributionToNodeDistribution(nodeOrder, distributionResult.pi);
  let matchingScore = 0;
  for (const [addr, score] of pi) {
    if (scoringPrefixes.some((p) => NodeAddress.hasPrefix(addr, p))) {
      matchingScore += score;
    }
  }
  if (matchingScore === 0) {
    throw new Error("no matching score");
  }
  const totalCred = sum(nodeWeights.values());
  const f = totalCred / matchingScore;
  const result = new Map();
  for (const [addr, score] of pi) {
    result.set(addr, score * f);
  }
  return result;
}
