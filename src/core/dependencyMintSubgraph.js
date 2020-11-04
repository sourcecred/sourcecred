// @flow

import {type TimestampMs} from "../util/timestamp";
import {type WeightedGraph as WeightedGraphT} from "./weightedGraph";
import {nodeWeightEvaluator} from "./algorithm/weightEvaluator";
import {partitionGraph} from "./interval";
import {
  Graph,
  type Node as GraphNode,
  type EdgeAddressT,
  type NodeAddressT,
  EdgeAddress,
  NodeAddress,
} from "./graph";
import {empty as emptyWeights} from "./weights";
import type {
  DependencyMintPolicy,
  DependencyMintPeriod,
} from "./dependenciesMintPolicy";

/**
 * Given a WeightedGraph and a set of policies, return a new WeightedGraph in
 * which extra "dependency mint" nodes have been added which mint Cred and flow
 * it directly to the dependencies. Within each period, each dependency will
 * get `weight` proportion of total _minted_ Cred in that period flowed
 * directly to it.
 *
 * TODO(#2449): Need to pipe in the Cred timing interval once we support
 * settings other than weekly.
 */
export function dependencySubgraph(
  wg: WeightedGraphT,
  policies: $ReadOnlyArray<DependencyMintPolicy>
): WeightedGraphT {
  const subgraph = {graph: new Graph(), weights: emptyWeights()};
  const mintIntervals = computeTotalMintedCredPerIntervals(wg);
  for (const {address, periods} of policies) {
    const recipient = wg.graph.node(address);
    if (recipient == null) {
      throw new Error(
        `dependency not in graph: ${NodeAddress.toString(address)}`
      );
    }
    subgraph.graph.addNode(recipient);
    for (const {startTimeMs, mintAmount} of intervalsWithMinting(
      mintIntervals,
      periods
    )) {
      if (mintAmount > 0) {
        const node = mintNode(recipient, startTimeMs);
        const edge = {
          src: node.address,
          dst: recipient.address,
          timestampMs: startTimeMs,
          address: mintEdgeAddress(recipient, startTimeMs),
        };
        subgraph.graph.addNode(node).addEdge(edge);
        subgraph.weights.nodeWeights.set(node.address, mintAmount);
      }
    }
  }
  return subgraph;
}

export type TotalMintedCredPerInterval = {|
  +startTimeMs: TimestampMs,
  +totalMint: number,
|};
export function computeTotalMintedCredPerIntervals(
  wg: WeightedGraphT
): $ReadOnlyArray<TotalMintedCredPerInterval> {
  const nwe = nodeWeightEvaluator(wg.weights);
  const partition = partitionGraph(wg.graph);
  return partition.map(({interval, nodes}) => {
    const {startTimeMs} = interval;
    let totalMint = 0;
    for (const {address} of nodes) {
      totalMint += nwe(address);
    }
    return {startTimeMs, totalMint};
  });
}

/**
 * Given the TotalMintedCredPerIntervals and the periods, yield a sequence of info on how
 * much Cred gets minted for this dep in each Interval.
 */
export function* intervalsWithMinting(
  mintIntervals: $ReadOnlyArray<TotalMintedCredPerInterval>,
  periods: $ReadOnlyArray<DependencyMintPeriod>
): Iterable<{|+startTimeMs: TimestampMs, +mintAmount: number|}> {
  let periodIndex = -1;

  for (const {startTimeMs, totalMint} of mintIntervals) {
    while (
      periodIndex + 1 < periods.length &&
      periods[periodIndex + 1].startTimeMs <= startTimeMs
    ) {
      periodIndex++;
    }
    const mintWeight = periodIndex === -1 ? 0 : periods[periodIndex].weight;
    yield {startTimeMs, mintAmount: mintWeight * totalMint};
  }
}

export const DEPENDENCY_NODE_PREFIX: NodeAddressT = NodeAddress.fromParts([
  "sourcecred",
  "core",
  "DEPENDENCY_MINT",
]);

export function mintNode(recipient: GraphNode, timestampMs: number): GraphNode {
  const address = NodeAddress.append(
    DEPENDENCY_NODE_PREFIX,
    String(timestampMs),
    ...NodeAddress.toParts(recipient.address)
  );
  const description = `Dependency Cred minting for ${
    recipient.description
  } for interval starting ${String(timestampMs)}`;
  return {
    address,
    description,
    timestampMs,
  };
}

export const DEPENDENCY_EDGE_PREFIX: EdgeAddressT = EdgeAddress.fromParts([
  "sourcecred",
  "core",
  "DEPENDENCY_MINT",
]);
export function mintEdgeAddress(
  recipient: GraphNode,
  timestampMs: number
): EdgeAddressT {
  return EdgeAddress.append(
    DEPENDENCY_EDGE_PREFIX,
    String(timestampMs),
    ...NodeAddress.toParts(recipient.address)
  );
}
