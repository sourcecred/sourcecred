// @flow

import {type Node as ReactNode} from "react";
import {Graph, type NodeAddressT, type EdgeAddressT} from "../../core/graph";
import type {Assets} from "../assets";
import type {RepoId} from "../../core/repoId";
import type {EdgeType, NodeType} from "../../analysis/types";

export interface StaticPluginAdapter {
  name(): string;
  nodePrefix(): NodeAddressT;
  edgePrefix(): EdgeAddressT;
  nodeTypes(): NodeType[];
  edgeTypes(): EdgeType[];
  load(assets: Assets, repoId: RepoId): Promise<DynamicPluginAdapter>;
}

export interface DynamicPluginAdapter {
  graph(): Graph;
  nodeDescription(NodeAddressT): ReactNode;
  static (): StaticPluginAdapter;
}
