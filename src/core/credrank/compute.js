// @flow

import {sum} from "d3-array";
import * as NullUtil from "../../util/null";
import {
  findStationaryDistribution,
  type PagerankParams,
  type PagerankOptions,
} from "../algorithm/markovChain";

import {distributionToNodeDistribution} from "../algorithm/graphToMarkovChain";

import {uniformDistribution} from "../algorithm/distribution";
import {accumulatorGadget} from "./nodeGadgets";
import {type MarkovProcessGraph} from "./markovProcessGraph";
import {CredGraph} from "./credGraph";

export const DEFAULT_MAX_ITERATIONS = 255;
export const DEFAULT_CONVERGENCE_THRESHOLD = 1e-7;
export const DEFAULT_YIELD_AFTER_MS = 30;
export const DEFAULT_VERBOSE = false;

export async function credrank(
  mpg: MarkovProcessGraph,
  options?: $Shape<PagerankOptions> = {}
): Promise<CredGraph> {
  const defaultOptions: PagerankOptions = {
    maxIterations: DEFAULT_MAX_ITERATIONS,
    convergenceThreshold: DEFAULT_CONVERGENCE_THRESHOLD,
    yieldAfterMs: DEFAULT_YIELD_AFTER_MS,
    verbose: DEFAULT_VERBOSE,
  };
  options = {...defaultOptions, ...options};
  const osmc = mpg.toMarkovChain();
  const params: PagerankParams = {
    chain: osmc.chain,
    pi0: uniformDistribution(osmc.nodeOrder.length),
    seed: uniformDistribution(osmc.nodeOrder.length),
    alpha: 0,
  };
  const distributionResult = await findStationaryDistribution(params, options);
  const pi = distributionToNodeDistribution(
    osmc.nodeOrder,
    distributionResult.pi
  );

  const matchingScore = sum(
    Array.from(mpg.nodes({prefix: accumulatorGadget.prefix})).map((n) =>
      NullUtil.get(pi.get(n.address))
    )
  );
  let totalNodeWeight = 0;
  for (const {mint: weight} of mpg.nodes()) {
    totalNodeWeight += weight;
  }
  const scores = osmc.nodeOrder.map(
    (_, i) => (distributionResult.pi[i] / matchingScore) * totalNodeWeight
  );
  return new CredGraph(mpg, scores);
}
