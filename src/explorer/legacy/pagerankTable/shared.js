// @flow

import React, {type Node as ReactNode} from "react";
import Markdown from "react-markdown";
import {
  Graph,
  type EdgeAddressT,
  type NodeAddressT,
  EdgeAddress,
} from "../../../core/graph";
import {type PluginDeclaration} from "../../../analysis/pluginDeclaration";

import type {PagerankNodeDecomposition} from "../../../analysis/pagerankNodeDecomposition";

export function nodeDescription(
  address: NodeAddressT,
  graph: Graph
): ReactNode {
  const node = graph.node(address);
  if (node == null) {
    throw new Error(`No node for ${address}`);
  }
  return <Markdown renderers={{paragraph: "span"}} source={node.description} />;
}

export function edgeVerb(
  address: EdgeAddressT,
  direction: "FORWARD" | "BACKWARD",
  declarations: $ReadOnlyArray<PluginDeclaration>
): string {
  function getType() {
    for (const {edgeTypes} of declarations) {
      for (const edgeType of edgeTypes) {
        if (EdgeAddress.hasPrefix(address, edgeType.prefix)) {
          return edgeType;
        }
      }
    }
    throw Error(`No matching type for ${address}`);
  }
  const edgeType = getType();
  return direction === "FORWARD" ? edgeType.forwardName : edgeType.backwardName;
}

export type SharedProps = {|
  +pnd: PagerankNodeDecomposition,
  +graph: Graph,
  +declarations: $ReadOnlyArray<PluginDeclaration>,
  +maxEntriesPerList: number,
  +nodeWeights: Map<NodeAddressT, number>,
  +onNodeWeightsChange: (NodeAddressT, number) => void,
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
