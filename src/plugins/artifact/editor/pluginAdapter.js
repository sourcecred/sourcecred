// @flow

import type {Graph, Node} from "../../../core/graph";
import type {ComponentType} from "react";

export interface PluginAdapter<-NodePayload> {
  pluginName: string;
  renderer: $Subtype<
    ComponentType<{graph: Graph<any, any>, node: Node<NodePayload>}>
  >;
  extractType(graph: Graph<any, any>, node: Node<NodePayload>): string;
  extractTitle(graph: Graph<any, any>, node: Node<NodePayload>): string;
}
