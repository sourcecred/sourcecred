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
import {
  MarkovProcessGraph,
  type Parameters as MarkovProcessGraphParameters,
} from "./markovProcessGraph";
import {type PersonalAttributions} from "./personalAttribution";
import {CredGraph} from "./credGraph";
import {type WeightedGraph} from "../weightedGraph";
import {Ledger} from "../ledger/ledger";
import {graphIntervals} from "../interval";

export const DEFAULT_MAX_ITERATIONS = 255;
export const DEFAULT_CONVERGENCE_THRESHOLD = 1e-7;
export const DEFAULT_YIELD_AFTER_MS = 30;
export const DEFAULT_VERBOSE = false;

const DEFAULT_ALPHA = 0.1;
const DEFAULT_BETA = 0.4;
const DEFAULT_GAMMA_FORWARD = 0.1;
const DEFAULT_GAMMA_BACKWARD = 0.1;

/**
 * Compute CredRank results given a WeightedGraph, a Ledger, and optional
 * parameters.
 */
export function credrank(
  weightedGraph: WeightedGraph,
  ledger: Ledger,
  personalAttributions?: PersonalAttributions = [],
  markovProcessGraphParameters?: $Shape<MarkovProcessGraphParameters> = {},
  pagerankOptions?: $Shape<PagerankOptions>
): Promise<CredGraph> {
  const defaultParameters: MarkovProcessGraphParameters = {
    alpha: DEFAULT_ALPHA,
    beta: DEFAULT_BETA,
    gammaForward: DEFAULT_GAMMA_FORWARD,
    gammaBackward: DEFAULT_GAMMA_BACKWARD,
  };

  const parameters: MarkovProcessGraphParameters = {
    ...defaultParameters,
    ...markovProcessGraphParameters,
  };
  const participants = ledger.accounts().map(({identity}) => ({
    description: identity.name,
    address: identity.address,
    id: identity.id,
  }));
  const intervals = graphIntervals(weightedGraph.graph);
  const mpg = MarkovProcessGraph.new({
    weightedGraph,
    participants,
    parameters,
    intervals,
    personalAttributions,
  });
  return markovProcessGraphPagerank(mpg, pagerankOptions);
}

/**
 * Given a MarkovProcessGraph, compute PageRank scores on it.
 */
export async function markovProcessGraphPagerank(
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
