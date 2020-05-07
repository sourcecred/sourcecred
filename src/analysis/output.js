// @flow

/**
 * This module defines a rich output format for cred scores, so that we can use
 * it to drive UIs and data analysis.
 */
import * as NullUtil from "../util/null";
import {NodeAddress} from "../core/graph";
import type {Alias} from "../plugins/identity/alias";
import type {PluginDeclaration} from "./pluginDeclaration";
import type {TimestampMs} from "../util/timestamp";
import * as Timestamp from "../util/timestamp";
import {TimelineCred} from "./timeline/timelineCred";
import {nodeWeightEvaluator} from "../core/algorithm/weightEvaluator";

export type Index = number;
export type CredFlow = {|+forwards: number, +backwards: number|};

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
export type OutputV1 = {|
  // Ordered by address
  +orderedNodes: $ReadOnlyArray<OutputNode>,
  +plugins: $ReadOnlyArray<PluginDeclaration>,
|};

export function fromTimelineCredAndPlugins(
  tc: TimelineCred,
  plugins: $ReadOnlyArray<PluginDeclaration>
): OutputV1 {
  const {graph, weights} = tc.weightedGraph();
  const nodeEvaluator = nodeWeightEvaluator(weights);
  const orderedNodes = Array.from(graph.nodes()).map(
    ({description, address, timestampMs}) => {
      const cred = NullUtil.get(tc.credNode(address)).total;
      // In TimelineCred, a node with a null timestamp will never mint cred, because we don't
      // know what period to mint it in.
      // When we transition to CredRank, we should remove this check.
      const minted = timestampMs == null ? 0 : nodeEvaluator(address);
      const timestamp =
        timestampMs == null ? null : Timestamp.fromNumber(timestampMs);
      return {
        address: NodeAddress.toParts(address),
        cred,
        minted,
        description,
        timestamp,
      };
    }
  );
  return {orderedNodes, plugins};
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

/**
 * The second version of the output format includes explicit contributor data,
 * with cred-over-time and convenient aliases for looking up particular
 * contributors.
 */
export type OutputV2 = {|
  +orderedNodes: $ReadOnlyArray<OutputNode>,
  +plugins: $ReadOnlyArray<PluginDeclaration>,
  +contributors: $ReadOnlyArray<Contributor>,
  +intervalEnd: $ReadOnlyArray<TimestampMs>,
|};

/**
 * This edge format includes the standard Graph.Edge information, along with
 * the cred flow across the edge. In TimelineCred, the cred flow will be summed
 * across every time period; once we switch to CredRank, the summing will no
 * longer be necessary.
 */
export type OutputEdge = {|
  +address: $ReadOnlyArray<string>,
  +credFlow: CredFlow,
  +timestamp: TimestampMs,
  +srcIndex: Index,
  +dstIndex: Index,
|};

export type OutputV3 = {|
  +orderedNodes: $ReadOnlyArray<OutputNode>,
  +plugins: $ReadOnlyArray<PluginDeclaration>,
  +contributors: $ReadOnlyArray<Contributor>,
  +intervalEnd: $ReadOnlyArray<TimestampMs>,
  +edges: $ReadOnlyArray<OutputEdge>,
|};
