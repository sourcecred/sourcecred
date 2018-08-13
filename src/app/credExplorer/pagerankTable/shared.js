// @flow

import {
  type EdgeAddressT,
  type NodeAddressT,
  NodeAddress,
} from "../../../core/graph";

import {DynamicAdapterSet} from "../../adapters/adapterSet";

import type {PagerankNodeDecomposition} from "../../../core/attribution/pagerankNodeDecomposition";

export function nodeDescription(
  address: NodeAddressT,
  adapters: DynamicAdapterSet
): string {
  const adapter = adapters.adapterMatchingNode(address);
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
  adapters: DynamicAdapterSet
): string {
  const edgeType = adapters.static().typeMatchingEdge(address);
  return direction === "FORWARD" ? edgeType.forwardName : edgeType.backwardName;
}

export type SharedProps = {|
  +pnd: PagerankNodeDecomposition,
  +adapters: DynamicAdapterSet,
  +maxEntriesPerList: number,
|};
