// @flow

import type {Graph, NodeAddressT, EdgeAddressT} from "../core/graph";

export interface Renderer {
  nodeDescription(NodeAddressT): string;
  edgeVerb(EdgeAddressT, "FORWARD" | "BACKWARD"): string;
}

export interface PluginAdapter {
  name(): string;
  graph(): Graph;
  renderer(): Renderer;
  nodePrefix(): NodeAddressT;
  edgePrefix(): EdgeAddressT;
  nodeTypes(): Array<{|
    +name: string,
    +prefix: NodeAddressT,
  |}>;
}
