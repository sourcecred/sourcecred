// @flow
import type {
  PluginAdapter as IPluginAdapter,
  Renderer as IRenderer,
} from "../../app/pluginAdapter";
import {Graph} from "../../core/graph";
import * as N from "./nodes";
import {description} from "./render";

export async function createPluginAdapter(
  repoOwner: string,
  repoName: string
): Promise<IPluginAdapter> {
  const url = `/api/v1/data/data/${repoOwner}/${repoName}/git/graph.json`;
  const response = await fetch(url);
  if (!response.ok) {
    return Promise.reject(response);
  }
  const json = await response.json();
  const graph = Graph.fromJSON(json);
  return new PluginAdapter(graph);
}

class PluginAdapter implements IPluginAdapter {
  +_graph: Graph;
  constructor(graph: Graph) {
    this._graph = graph;
  }
  graph() {
    return this._graph;
  }
  renderer() {
    return new Renderer();
  }
  nodePrefix() {
    return N._Prefix.base;
  }
}

class Renderer implements IRenderer {
  nodeDescription(node) {
    // This cast is unsound, and might throw at runtime, but won't have
    // silent failures or cause problems down the road.
    const address = N.fromRaw((node: any));
    return description(address);
  }
}
