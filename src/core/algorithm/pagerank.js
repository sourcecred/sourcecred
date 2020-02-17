// @flow

import {sum} from "d3-array";
import * as NullUtil from "../../util/null";
import {
  findStationaryDistribution,
  type PagerankParams,
  type PagerankOptions,
} from "./markovChain";

import {type NodeAddressT} from "../graph";
import {distributionToNodeDistribution} from "./graphToMarkovChain";

import {uniformDistribution} from "./distribution";
import {
  type FibrationOptions,
  type SeedOptions,
  MarkovProcessGraph,
} from "../markovProcessGraph";
import {type WeightedGraph} from "../weightedGraph";
import {CredGraph} from "../credGraph";

export type Options = {|
  +fibrationOptions: FibrationOptions,
  +seedOptions: SeedOptions,
  +pagerankOptions: $Shape<PagerankOptions>,
|};

export const DEFAULT_MAX_ITERATIONS = 255;
export const DEFAULT_CONVERGENCE_THRESHOLD = 1e-7;
export const DEFAULT_YIELD_AFTER_MS = 30;
export const DEFAULT_VERBOSE = false;

export async function pagerank(
  wg: WeightedGraph,
  options: Options
): Promise<CredGraph> {
  const defaultOptions: PagerankOptions = {
    maxIterations: DEFAULT_MAX_ITERATIONS,
    convergenceThreshold: DEFAULT_CONVERGENCE_THRESHOLD,
    yieldAfterMs: DEFAULT_YIELD_AFTER_MS,
    verbose: DEFAULT_VERBOSE,
  };
  const pagerankOptions = {...defaultOptions, ...options.pagerankOptions};
  const mpg = new MarkovProcessGraph(
    wg,
    options.fibrationOptions,
    options.seedOptions
  );
  const osmc = mpg.toMarkovChain();
  const params: PagerankParams = {
    chain: osmc.chain,
    pi0: uniformDistribution(osmc.nodeOrder.length),
    seed: uniformDistribution(osmc.nodeOrder.length),
    alpha: 0,
  };
  const distributionResult = await findStationaryDistribution(
    params,
    pagerankOptions
  );
  const pi = distributionToNodeDistribution(
    osmc.nodeOrder,
    distributionResult.pi
  );

  const matchingScore = sum(
    Array.from(mpg.scoringAddresses()).map((a) => NullUtil.get(pi.get(a)))
  );
  const cred: Map<NodeAddressT, number> = new Map();
  let totalNodeWeight = 0;
  for (const {weight} of mpg.nodes()) {
    totalNodeWeight += weight;
  }
  osmc.nodeOrder.forEach((node, index) => {
    cred.set(
      node,
      (distributionResult.pi[index] / matchingScore) * totalNodeWeight
    );
  });
  return new CredGraph(mpg, cred);
}
