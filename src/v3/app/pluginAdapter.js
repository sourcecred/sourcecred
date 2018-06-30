// @flow

import type {Graph, NodeAddressT} from "../core/graph";

export interface Renderer {
  nodeDescription(NodeAddressT): string;
}

export interface PluginAdapter {
  name(): string;
  graph(): Graph;
  renderer(): Renderer;
  nodePrefix(): NodeAddressT;
  nodeTypes(): Array<{|
    +name: string,
    +prefix: NodeAddressT,
  |}>;
}
