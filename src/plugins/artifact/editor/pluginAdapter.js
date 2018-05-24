// @flow

import type {Graph, Node} from "../../../core/graph";
import type {ComponentType} from "react";

export interface PluginAdapter<-NodePayload> {
  pluginName: string;
  renderer: $Subtype<ComponentType<{graph: Graph, node: Node<NodePayload>}>>;
  extractTitle(graph: Graph, node: Node<NodePayload>): string;
}
