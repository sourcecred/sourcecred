// @flow

import {
  type WeightedGraph,
  type WeightedGraphJSON,
  toJSON as wgToJSON,
  fromJSON as wgFromJSON,
} from "../core/weightedGraph";
import {NodeAddress} from "../core/graph";
import {type Compatible, toCompat, fromCompat} from "../util/compat";
import {
  type TimelineCredParameters,
  type TimelineCredParametersJSON,
  paramsToJSON,
  paramsFromJSON,
} from "./timeline/params";
import {
  type PluginDeclarations,
  type PluginDeclarationsJSON,
  toJSON as pluginsToJSON,
  fromJSON as pluginsFromJSON,
} from "./pluginDeclaration";
import {timelinePagerank} from "../core/algorithm/timelinePagerank";
import {
  type CredData,
  computeCredData,
  compressByThreshold as _compressByThreshold,
  compressDownToMatchingIndices,
} from "./credData";
import {distributionToCred} from "../core/algorithm/distributionToCred";
import {type BonusPolicy} from "../core/bonusMinting";
import {IDENTITY_PREFIX} from "../core/identity";

/**
 * Comprehensive cred output data, including the graph, the scores, the params, and the plugins.
 */
export type CredResult = {|
  // The Graph on which this cred data was computed.
  +weightedGraph: WeightedGraph,
  // Cred level information, always stored in graph address order.
  +credData: CredData,
  // Parameters used to compute this cred data
  +params: TimelineCredParameters,
  // Plugin declarations used to compute this cred data
  +plugins: PluginDeclarations,
  // Policies on minting Cred
  +bonusPolicies: $ReadOnlyArray<BonusPolicy>,
|};

export async function compute(
  wg: WeightedGraph,
  params: TimelineCredParameters,
  plugins: PluginDeclarations,
  bonusPolicies: $ReadOnlyArray<BonusPolicy>
): Promise<CredResult> {
  const {graph} = wg;
  const nodeOrder = Array.from(graph.nodes()).map((x) => x.address);
  const scorePrefixes = [IDENTITY_PREFIX];
  const distribution = await timelinePagerank(
    wg,
    params.intervalDecay,
    params.alpha
  );
  const credScores = distributionToCred(distribution, nodeOrder, scorePrefixes);
  const credData = computeCredData(credScores, nodeOrder, bonusPolicies);
  return {weightedGraph: wg, credData, params, plugins, bonusPolicies};
}

// Lossily compress a CredResult, by throwing away time-specific cred
// data for any flows that summed to less than `threshold` cred.
// We may want to implement more sophisticated and context-aware strategies
// in the future.
export function compressByThreshold(
  x: CredResult,
  threshold: number
): CredResult {
  const {params, plugins, weightedGraph, credData, bonusPolicies} = x;
  return {
    params,
    plugins,
    weightedGraph,
    credData: _compressByThreshold(credData, threshold),
    bonusPolicies,
  };
}

export function stripOverTimeDataForNonUsers(x: CredResult): CredResult {
  const {params, plugins, weightedGraph, credData, bonusPolicies} = x;
  const nodeOrder = Array.from(weightedGraph.graph.nodes()).map(
    (x) => x.address
  );
  const inclusionIndices = new Set();
  nodeOrder.forEach((a, i) => {
    if (NodeAddress.hasPrefix(a, IDENTITY_PREFIX)) {
      inclusionIndices.add(i);
    }
  });
  const newCredData = compressDownToMatchingIndices(credData, inclusionIndices);
  return {
    params,
    plugins,
    weightedGraph,
    credData: newCredData,
    bonusPolicies,
  };
}

const COMPAT_INFO = {type: "sourcecred/credResult", version: "0.1.0"};

export type CredResultJSON = Compatible<{|
  +weightedGraph: WeightedGraphJSON,
  +credData: CredData,
  +params: TimelineCredParametersJSON,
  +plugins: PluginDeclarationsJSON,
  // Name is vestigial, but this whole data type is getting replaced soon, so
  // no need to update it.
  +dependencyPolicies: $ReadOnlyArray<BonusPolicy>,
|}>;

export function toJSON(x: CredResult): CredResultJSON {
  const {weightedGraph, credData, params, plugins} = x;
  return toCompat(COMPAT_INFO, {
    weightedGraph: wgToJSON(weightedGraph),
    credData,
    params: paramsToJSON(params),
    plugins: pluginsToJSON(plugins),
    dependencyPolicies: x.bonusPolicies,
  });
}

export function fromJSON(j: CredResultJSON): CredResult {
  const x = fromCompat(COMPAT_INFO, j);
  const {weightedGraph, credData, params, plugins, dependencyPolicies} = x;
  return {
    weightedGraph: wgFromJSON(weightedGraph),
    credData,
    params: paramsFromJSON(params),
    plugins: pluginsFromJSON(plugins),
    bonusPolicies: dependencyPolicies,
  };
}
