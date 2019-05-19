// @flow

import React, {type Node as ReactNode} from "react";
import {
  type EdgeAddressT,
  type NodeAddressT,
  NodeAddress,
} from "../../core/graph";

import {DynamicExplorerAdapterSet} from "../adapters/explorerAdapterSet";

import type {PagerankNodeDecomposition} from "../../analysis/pagerankNodeDecomposition";

export function nodeDescription(
  address: NodeAddressT,
  adapters: DynamicExplorerAdapterSet
): ReactNode {
  const adapter = adapters.adapterMatchingNode(address);
  if (adapter == null) {
    return NodeAddress.toString(address);
  }
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
  adapters: DynamicExplorerAdapterSet
): string {
  const edgeType = adapters.static().typeMatchingEdge(address);
  return direction === "FORWARD" ? edgeType.forwardName : edgeType.backwardName;
}

export type SharedProps = {|
  +pnd: PagerankNodeDecomposition,
  +adapters: DynamicExplorerAdapterSet,
  +maxEntriesPerList: number,
  +manualWeights: Map<NodeAddressT, number>,
  +onManualWeightsChange: (NodeAddressT, number) => void,
|};

export function Badge({children}: {children: ReactNode}): ReactNode {
  return (
    // The outer <span> acts as a strut to ensure that the badge
    // takes up a full line height, even though its text is smaller.
    <span>
      <span
        style={{
          textTransform: "uppercase",
          fontWeight: 700,
          fontSize: "smaller",
        }}
      >
        {children}
      </span>
    </span>
  );
}
