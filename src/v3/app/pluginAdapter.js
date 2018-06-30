// @flow

import type {Graph, NodeAddressT} from "../core/graph";

export interface Renderer {
  nodeDescription(NodeAddressT): string;
}

export interface PluginAdapter {
  graph(): Graph;
  renderer(): Renderer;
  nodePrefix(): NodeAddressT;
}
