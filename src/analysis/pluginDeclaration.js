// @flow

import {type NodeAddressT, type EdgeAddressT} from "../core/graph";
import type {EdgeType, NodeType, NodeAndEdgeTypes} from "./types";

// TODO(@decentralion): Maybe merge this file with analysis/types

export type PluginDeclaration = {|
  +name: string,
  +nodePrefix: NodeAddressT,
  +edgePrefix: EdgeAddressT,
  +nodeTypes: $ReadOnlyArray<NodeType>,
  +edgeTypes: $ReadOnlyArray<EdgeType>,
  // Which node types represent user identities.
  // Important for computing score and for display in the frontend.
  // It's expected that the userTypes will also be included in the array of
  // nodeTypes.
  +userTypes: $ReadOnlyArray<NodeType>,
|};

export function combineTypes(
  decs: $ReadOnlyArray<PluginDeclaration>
): NodeAndEdgeTypes {
  const nodeTypes = [].concat(...decs.map((x) => x.nodeTypes));
  const edgeTypes = [].concat(...decs.map((x) => x.edgeTypes));
  return {nodeTypes, edgeTypes};
}
