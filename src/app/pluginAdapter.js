// @flow

import type {Graph, NodeAddressT, EdgeAddressT} from "../core/graph";

export interface PluginAdapter {
  name(): string;
  graph(): Graph;
  nodePrefix(): NodeAddressT;
  edgePrefix(): EdgeAddressT;
  nodeTypes(): Array<{|
    +name: string,
    +prefix: NodeAddressT,
  |}>;
  nodeDescription(NodeAddressT): string;
  edgeTypes(): Array<{|
    +forwardName: string,
    +backwardName: string,
    +prefix: EdgeAddressT,
  |}>;
}
