// @flow

import {type NodeAddressT, type EdgeAddressT} from "../core/graph";
import type {EdgeType, NodeType} from "./types";

export type PluginDeclaration = {|
  +name: string,
  +nodePrefix: NodeAddressT,
  +edgePrefix: EdgeAddressT,
  +nodeTypes: $ReadOnlyArray<NodeType>,
  +edgeTypes: $ReadOnlyArray<EdgeType>,
|};
