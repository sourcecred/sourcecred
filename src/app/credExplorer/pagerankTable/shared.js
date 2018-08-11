// @flow

import {
  type EdgeAddressT,
  type NodeAddressT,
  NodeAddress,
} from "../../../core/graph";

import type {PagerankNodeDecomposition} from "../../../core/attribution/pagerankNodeDecomposition";

import {
  type DynamicPluginAdapter,
  dynamicDispatchByNode,
  dynamicDispatchByEdge,
  findEdgeType,
} from "../../adapters/pluginAdapter";

export function nodeDescription(
  address: NodeAddressT,
  adapters: $ReadOnlyArray<DynamicPluginAdapter>
): string {
  const adapter = dynamicDispatchByNode(adapters, address);
  try {
    return adapter.nodeDescription(address);
  } catch (e) {
    const result = NodeAddress.toString(address);
    console.error(`Error getting description for ${result}: ${e.message}`);
    return result;
  }
}

export function edgeVerb(
  address: EdgeAddressT,
  direction: "FORWARD" | "BACKWARD",
  adapters: $ReadOnlyArray<DynamicPluginAdapter>
): string {
  const adapter = dynamicDispatchByEdge(adapters, address);
  const edgeType = findEdgeType(adapter.static(), address);
  return direction === "FORWARD" ? edgeType.forwardName : edgeType.backwardName;
}

export function scoreDisplay(score: number) {
  return score.toFixed(2);
}

export type SharedProps = {|
  +pnd: PagerankNodeDecomposition,
  +adapters: $ReadOnlyArray<DynamicPluginAdapter>,
  +maxEntriesPerList: number,
|};

export type RowState = {|
  expanded: boolean,
|};
