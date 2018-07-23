// @flow

import type {Graph, NodeAddressT, EdgeAddressT} from "../core/graph";

export interface StaticPluginAdapter {
  name(): string;
  nodePrefix(): NodeAddressT;
  edgePrefix(): EdgeAddressT;
  nodeTypes(): Array<{|
    +name: string,
    +prefix: NodeAddressT,
  |}>;
  edgeTypes(): Array<{|
    +forwardName: string,
    +backwardName: string,
    +prefix: EdgeAddressT,
  |}>;
  load(repoOwner: string, repoName: string): Promise<DynamicPluginAdapter>;
}

export interface DynamicPluginAdapter {
  graph(): Graph;
  nodeDescription(NodeAddressT): string;
  static (): StaticPluginAdapter;
}
