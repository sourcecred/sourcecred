// @flow

/**
 * This module defines a rich output format for cred scores, so that we can use
 * it to drive UIs and data analysis.
 */
import * as NullUtil from "../util/null";
import {NodeAddress, EdgeAddress} from "../core/graph";
import type {Alias} from "../plugins/identity/alias";
import {
  type PluginDeclaration,
  type PluginDeclarations,
  type PluginDeclarationsJSON,
  toJSON as pluginsToJSON,
} from "./pluginDeclaration";
import type {TimestampMs} from "../util/timestamp";
import {TimelineCred} from "./timeline/timelineCred";
import {
  type TimelineCredParametersJSON,
  type TimelineCredParameters,
  paramsToJSON,
} from "./timeline/params";
import {
  nodeWeightEvaluator,
  edgeWeightEvaluator,
} from "../core/algorithm/weightEvaluator";
import {toCompat, fromCompat, type Compatible} from "../util/compat";
import {type EdgeWeight} from "../core/weights";
import {type WeightedGraph} from "../core/weightedGraph";
import {type TimelineCredScores} from "../core/algorithm/distributionToCred";

export type Index = number;
export type CredFlow = {|+forwards: number, +backwards: number|};

/**
 * Since this is intended to be used as an output format
 * (e.g. written to disk, consumed by external tools), we always compatibilze it
 * by default. The `extract` method may be used to pull the underlying data type out
 * from the compatible object.
 */
export type OutputV1 = Compatible<RawOutputV1>;
export const COMPAT_INFO_V1 = {
  type: "sourcecred/analysis/output",
  version: "0.2.0",
};

/**
 * Describes an individual node in the contribution graph.
 * Includes the information in the raw Graph node, along with scoring
 * information, i.e. its total cred, and the amount of cred that it minted.
 *
 * While we are in TimelineCred, the "cred" field will have the total cred,
 * summed across all time slices. Once we migrate to CredRank, it will just be
 * the cred directly calculated by the CredRank algorithm.
 */
export type OutputNode = {|
  +address: $ReadOnlyArray<string>,
  +cred: number,
  // Full cred over time (aligned with output interval boundaries).
  // It's optional because it inflates the output size a lot -- we'll
  // want to filter out low-cred nodes for large projects
  +credOverTime: ?$ReadOnlyArray<number>,
  +minted: number,
  +timestamp: TimestampMs | null,
  // Description comes from the underlying Graph node, so it's determined by the
  // plugin that added the node. May contain markdown.
  +description: string,
|};

/**
 * The first version of the output format will have the nodes, and the plugin
 * declarations. Including the declarations makes it easy for consumers to do
 * analyses like: how much cred was minted within each plugin? Within each
 * contribution type? Etc.
 */
export type RawOutputV1 = {|
  // Ordered by address
  +orderedNodes: $ReadOnlyArray<OutputNode>,
  +plugins: $ReadOnlyArray<PluginDeclaration>,
  // Interval endpoints, aligned with credOverTime
  +intervalEndpoints: $ReadOnlyArray<TimestampMs>,
|};

export function fromTimelineCredAndPlugins(
  tc: TimelineCred,
  plugins: $ReadOnlyArray<PluginDeclaration>
): OutputV1 {
  const {graph, weights} = tc.weightedGraph();
  const nodeEvaluator = nodeWeightEvaluator(weights);
  const intervalEndpoints = tc.intervals().map((x) => x.endTimeMs);
  const orderedNodes = Array.from(graph.nodes()).map(
    ({description, address, timestampMs}) => {
      const {cred, total} = NullUtil.get(tc.credNode(address));
      // In TimelineCred, a node with a null timestamp will never mint cred, because we don't
      // know what period to mint it in.
      // When we transition to CredRank, we should remove this check.
      const minted = timestampMs == null ? 0 : nodeEvaluator(address);
      return {
        address: NodeAddress.toParts(address),
        cred: total,
        // todo: add optional filtering to reduce the data size
        credOverTime: cred,
        minted,
        description,
        timestamp: timestampMs,
      };
    }
  );
  return toCompat(COMPAT_INFO_V1, {orderedNodes, plugins, intervalEndpoints});
}

/**
 * Extract the raw output data from the compatible object.
 */
export function extractV1(o: OutputV1): RawOutputV1 {
  return fromCompat(COMPAT_INFO_V1, o);
}

/**
 * Extra data for Contributors. Note that each Contributor corresponds
 * to a specific node in the graph, which is retrievable via the NodeIndex.
 *
 * For contributors, we'll give the cred-over-time. We don't include this
 * information for regular contribution nodes, both because it's not that
 * interesting, and because once we migrate to CredRank, we won't have that
 * level of resolution anymore.
 *
 * While we are in TimelineCred, the credOverTime will be the raw cred that the
 * contributor recieved in each time slice. Once we switch to TimelineCred, the
 * credOverTime will instead be the amount of cred that flowed from the
 * contributor's epoch node to that contributor for each time period. (Cred at
 * the contributor's epoch node may also flow to other destinations, e.g. to
 * past/future epoch nodes through the webbing edges, or to a team or sponsor.)
 *
 *
 * In either case, it will be an invariant that the sum of the credOverTime will
 * correspond to the cred score on the raw OutputNode (up to floating point
 * precision).
 */
export type Contributor = {|
  +alias: Alias,
  // Indexed into the orderedNodes
  +nodeIndex: Index,
  // Matches the interval endpoints in the full output format.
  +credOverTime: $ReadOnlyArray<number>,
|};

export type PartsAddress = $ReadOnlyArray<string>;

export type NodeCredInfo = {|
  +cred: number,
  +seedFlow: number,
  +syntheticLoopFlow: number,
|};
export type Node2 = {|
  +address: PartsAddress,
  +description: string,
  +totalCred: NodeCredInfo,
  +credOverTime: $ReadOnlyArray<NodeCredInfo> | null,
  +timestamp: TimestampMs | null,
  +minted: number,
|};

export type EdgeCredInfo = {|
  +forwardFlow: number,
  +backwardFlow: number,
|};
export type Edge2 = {|
  +address: PartsAddress,
  +srcIndex: number,
  +dstIndex: number,
  +totalCred: EdgeCredInfo,
  +credOverTime: $ReadOnlyArray<EdgeCredInfo> | null,
  +timestamp: TimestampMs,
  +rawWeight: EdgeWeight,
|};

export type RawOutputV2 = {|
  // Ordered by address
  +orderedNodes: $ReadOnlyArray<Node2>,
  +orderedEdges: $ReadOnlyArray<Edge2>,
  +plugins: PluginDeclarationsJSON,
  // Interval endpoints, aligned with credOverTime
  +intervalEndpoints: $ReadOnlyArray<TimestampMs>,
  +params: TimelineCredParametersJSON,
|};

export type OutputV2 = Compatible<RawOutputV2>;
export const COMPAT_INFO_V2 = {
  type: "sourcecred/analysis/output",
  version: "0.3.0",
};

export function rawOutputV2(
  wg: WeightedGraph,
  scores: TimelineCredScores,
  params: TimelineCredParameters,
  plugins: PluginDeclarations
): RawOutputV2 {
  const {graph, weights} = wg;
  const intervalEndpoints = scores.map((x) => x.interval.endTimeMs);
  const nodeEvaluator = nodeWeightEvaluator(weights);
  const edgeEvaluator = edgeWeightEvaluator(weights);
  const nodes = Array.from(graph.nodes());
  const edges = Array.from(graph.edges({showDangling: false}));

  const nodeAddressToIndex = new Map();
  const orderedNodes = nodes.map((node, nodeIndex) => {
    const {address, description, timestampMs} = node;
    nodeAddressToIndex.set(address, nodeIndex);
    const totalCred = {cred: 0, seedFlow: 0, syntheticLoopFlow: 0};
    const credOverTime = intervalEndpoints.map((_, intervalIndex) => {
      const {cred, seedFlow, syntheticLoopFlow} = scores[intervalIndex];
      const entry = {
        seedFlow: seedFlow[nodeIndex],
        syntheticLoopFlow: syntheticLoopFlow[nodeIndex],
        cred: cred[nodeIndex],
      };
      totalCred.seedFlow += entry.seedFlow;
      totalCred.syntheticLoopFlow += entry.syntheticLoopFlow;
      totalCred.cred += entry.cred;
      return entry;
    });
    return {
      credOverTime,
      totalCred,
      description,
      address: NodeAddress.toParts(address),
      timestamp: timestampMs,
      minted: nodeEvaluator(address),
    };
  });

  const orderedEdges = edges.map((edge, edgeIndex) => {
    const {src, dst, timestampMs, address} = edge;
    const srcIndex = NullUtil.get(nodeAddressToIndex.get(src));
    const dstIndex = NullUtil.get(nodeAddressToIndex.get(dst));
    const totalCred = {forwardFlow: 0, backwardFlow: 0};
    const credOverTime = intervalEndpoints.map((_, intervalIndex) => {
      const {forwardFlow, backwardFlow} = scores[intervalIndex];
      const entry = {
        forwardFlow: forwardFlow[edgeIndex],
        backwardFlow: backwardFlow[edgeIndex],
      };
      totalCred.forwardFlow += entry.forwardFlow;
      totalCred.backwardFlow += entry.backwardFlow;
      return entry;
    });
    return {
      address: EdgeAddress.toParts(address),
      timestamp: timestampMs,
      credOverTime,
      totalCred,
      srcIndex,
      dstIndex,
      rawWeight: edgeEvaluator(address),
    };
  });

  return {
    orderedNodes,
    orderedEdges,
    intervalEndpoints,
    params: paramsToJSON(params),
    plugins: pluginsToJSON(plugins),
  };
}

export function output2(
  wg: WeightedGraph,
  scores: TimelineCredScores,
  params: TimelineCredParameters,
  plugins: PluginDeclarations
): OutputV2 {
  return toCompat(COMPAT_INFO_V2, rawOutputV2(wg, scores, params, plugins));
}

export function extractV2(o: OutputV2): RawOutputV2 {
  return fromCompat(COMPAT_INFO_V2, o);
}
