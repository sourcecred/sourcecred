// @flow

import type {
  Graph,
  NodeAddressT,
  EdgeAddressT,
  NodeType,
  EdgeType,
} from "../core/graph";
import type {Repo} from "../core/repo";

export interface StaticPluginAdapter {
  name(): string;
  nodePrefix(): NodeAddressT;
  edgePrefix(): EdgeAddressT;
  nodeTypes(): NodeType[];
  edgeTypes(): EdgeType[];
  load(repo: Repo): Promise<DynamicPluginAdapter>;
}

export interface DynamicPluginAdapter {
  graph(): Graph;
  nodeDescription(NodeAddressT): string;
  static (): StaticPluginAdapter;
}
