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

export type Output2NodeData = {|
  +address: $ReadOnlyArray<PartsAddress>,
  +description: $ReadOnlyArray<string>,
  +totalCred: $ReadOnlyArray<number>,
  +totalSeedFlow: $ReadOnlyArray<number>,
  +totalSyntheticLoopFlow: $ReadOnlyArray<number>,
  +minted: $ReadOnlyArray<number>,
  +timestamp: $ReadOnlyArray<number | null>,
  +credOverTime: $ReadOnlyArray<$ReadOnlyArray<number> | null>,
  +seedFlowOverTime: $ReadOnlyArray<$ReadOnlyArray<number> | null>,
  +syntheticLoopFlowOverTime: $ReadOnlyArray<$ReadOnlyArray<number> | null>,
|};

export type Output2EdgeData = {|
  +address: $ReadOnlyArray<PartsAddress>,
  +srcIndex: $ReadOnlyArray<number>,
  +dstIndex: $ReadOnlyArray<number>,
  +timestamp: $ReadOnlyArray<number>,
  +totalForwardFlow: $ReadOnlyArray<number>,
  +totalBackwardFlow: $ReadOnlyArray<number>,
  +forwardFlowOverTime: $ReadOnlyArray<$ReadOnlyArray<number> | null>,
  +backwardFlowOverTime: $ReadOnlyArray<$ReadOnlyArray<number> | null>,
  +rawForwardWeight: $ReadOnlyArray<number>,
  +rawBackwardWeight: $ReadOnlyArray<number>,
|};

export type RawOutputV2 = {|
  +nodeData: Output2NodeData,
  +edgeData: Output2EdgeData,
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

  const nodeData = {
    address: new Array(nodes.length),
    description: new Array(nodes.length),
    totalCred: new Array(nodes.length),
    totalSeedFlow: new Array(nodes.length),
    totalSyntheticLoopFlow: new Array(nodes.length),
    minted: new Array(nodes.length),
    timestamp: new Array(nodes.length),
    credOverTime: new Array(nodes.length),
    seedFlowOverTime: new Array(nodes.length),
    syntheticLoopFlowOverTime: new Array(nodes.length),
  };
  const nodeAddressToIndex = new Map();
  nodes.forEach((node, nodeIndex) => {
    const {address, description, timestampMs} = node;
    nodeData.address[nodeIndex] = NodeAddress.toParts(address);
    nodeData.description[nodeIndex] = description;
    nodeData.timestamp[nodeIndex] = timestampMs;
    nodeAddressToIndex.set(address, nodeIndex);

    const credOverTime = new Array(intervalEndpoints.length);
    const seedFlowOverTime = new Array(intervalEndpoints.length);
    const syntheticLoopFlowOverTime = new Array(intervalEndpoints.length);
    nodeData.credOverTime[nodeIndex] = credOverTime;
    nodeData.seedFlowOverTime[nodeIndex] = seedFlowOverTime;
    nodeData.syntheticLoopFlowOverTime[nodeIndex] = syntheticLoopFlowOverTime;
    let totalCred = 0;
    let totalSeedFlow = 0;
    let totalSyntheticLoopFlow = 0;
    intervalEndpoints.forEach((_, intervalIndex) => {
      const {cred, seedFlow, syntheticLoopFlow} = scores[intervalIndex];
      totalCred += cred[nodeIndex];
      credOverTime[intervalIndex] = cred[nodeIndex];
      totalSeedFlow += seedFlow[nodeIndex];
      seedFlowOverTime[intervalIndex] = seedFlow[nodeIndex];
      totalSyntheticLoopFlow += syntheticLoopFlow[nodeIndex];
      syntheticLoopFlowOverTime[intervalIndex] = syntheticLoopFlow[nodeIndex];
    });
    if (totalCred < 10) {
      nodeData.credOverTime[nodeIndex] = null;
      nodeData.seedFlowOverTime[nodeIndex] = null;
      nodeData.syntheticLoopFlowOverTime[nodeIndex] = null;
    }
  });

  const edgeData = {
    address: new Array(edges.length),
    srcIndex: new Array(edges.length),
    dstIndex: new Array(edges.length),
    timestamp: new Array(edges.length),
    totalForwardFlow: new Array(edges.length),
    totalBackwardFlow: new Array(edges.length),
    forwardFlowOverTime: new Array(edges.length),
    backwardFlowOverTime: new Array(edges.length),
    rawForwardWeight: new Array(edges.length),
    rawBackwardWeight: new Array(edges.length),
  };
  edges.forEach((edge, edgeIndex) => {
    const {src, dst, timestampMs, address} = edge;
    edgeData.address[edgeIndex] = EdgeAddress.toParts(address);
    edgeData.timestamp[edgeIndex] = timestampMs;
    const srcIndex = NullUtil.get(nodeAddressToIndex.get(src));
    const dstIndex = NullUtil.get(nodeAddressToIndex.get(dst));
    edgeData.srcIndex[edgeIndex] = srcIndex;
    edgeData.dstIndex[edgeIndex] = dstIndex;
    let totalForwardFlow = 0;
    let totalBackwardFlow = 0;
    edgeData.forwardFlowOverTime[edgeIndex] = new Array(
      intervalEndpoints.length
    );
    edgeData.backwardFlowOverTime[edgeIndex] = new Array(
      intervalEndpoints.length
    );
    intervalEndpoints.map((_, intervalIndex) => {
      const forwardFlow = scores[intervalIndex].forwardFlow[edgeIndex];
      totalForwardFlow += forwardFlow;
      const backwardFlow = scores[intervalIndex].backwardFlow[edgeIndex];
      totalBackwardFlow += backwardFlow;
      edgeData.forwardFlowOverTime[edgeIndex][intervalIndex] = forwardFlow;
      edgeData.backwardFlowOverTime[edgeIndex][intervalIndex] = backwardFlow;
    });
    if (totalForwardFlow < 10 && totalBackwardFlow < 10) {
      edgeData.forwardFlowOverTime[edgeIndex] = null;
      edgeData.backwardFlowOverTime[edgeIndex] = null;
    }
    const rawWeight = edgeEvaluator(address);
    edgeData.rawForwardWeight[edgeIndex] = rawWeight.forwards;
    edgeData.rawBackwardWeight[edgeIndex] = rawWeight.backwards;
  });

  return {
    nodeData,
    edgeData,
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
