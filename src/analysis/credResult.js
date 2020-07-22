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
|};

export async function compute(
  wg: WeightedGraph,
  params: TimelineCredParameters,
  plugins: PluginDeclarations
): Promise<CredResult> {
  const {graph} = wg;
  const nodeOrder = Array.from(graph.nodes()).map((x) => x.address);
  const userTypes = [].concat(...plugins.map((x) => x.userTypes));
  const scorePrefixes = userTypes.map((x) => x.prefix);
  const distribution = await timelinePagerank(
    wg,
    params.intervalDecay,
    params.alpha
  );
  const credScores = distributionToCred(distribution, nodeOrder, scorePrefixes);
  const credData = computeCredData(credScores);
  return {weightedGraph: wg, credData, params, plugins};
}

// Lossily compress a CredResult, by throwing away time-specific cred
// data for any flows that summed to less than `threshold` cred.
// We may want to implement more sophisticated and context-aware strategies
// in the future.
export function compressByThreshold(
  x: CredResult,
  threshold: number
): CredResult {
  const {params, plugins, weightedGraph, credData} = x;
  return {
    params,
    plugins,
    weightedGraph,
    credData: _compressByThreshold(credData, threshold),
  };
}

export function stripOverTimeDataForNonUsers(x: CredResult): CredResult {
  const {params, plugins, weightedGraph, credData} = x;
  const userPrefixes = []
    .concat(...plugins.map((x) => x.userTypes))
    .map((x) => x.prefix);
  const nodeOrder = Array.from(weightedGraph.graph.nodes()).map(
    (x) => x.address
  );
  const inclusionIndices = new Set();
  nodeOrder.forEach((a, i) => {
    if (userPrefixes.some((p) => NodeAddress.hasPrefix(a, p))) {
      inclusionIndices.add(i);
    }
  });
  const newCredData = compressDownToMatchingIndices(credData, inclusionIndices);
  return {params, plugins, weightedGraph, credData: newCredData};
}

const COMPAT_INFO = {type: "sourcecred/credResult", version: "0.1.0"};

export type CredResultJSON = Compatible<{|
  +weightedGraph: WeightedGraphJSON,
  +credData: CredData,
  +params: TimelineCredParametersJSON,
  +plugins: PluginDeclarationsJSON,
|}>;

export function toJSON(x: CredResult): CredResultJSON {
  const {weightedGraph, credData, params, plugins} = x;
  return toCompat(COMPAT_INFO, {
    weightedGraph: wgToJSON(weightedGraph),
    credData,
    params: paramsToJSON(params),
    plugins: pluginsToJSON(plugins),
  });
}

export function fromJSON(j: CredResultJSON): CredResult {
  const x = fromCompat(COMPAT_INFO, j);
  const {weightedGraph, credData, params, plugins} = x;
  return {
    weightedGraph: wgFromJSON(weightedGraph),
    credData,
    params: paramsFromJSON(params),
    plugins: pluginsFromJSON(plugins),
  };
}
