// @flow
import type {PluginAdapter as IPluginAdapter} from "../../app/pluginAdapter";
import {Graph} from "../../core/graph";
import * as N from "./nodes";
import * as E from "./edges";
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
  name() {
    return "Git";
  }
  graph() {
    return this._graph;
  }
  nodePrefix() {
    return N._Prefix.base;
  }
  edgePrefix() {
    return E._Prefix.base;
  }
  nodeDescription(node) {
    // This cast is unsound, and might throw at runtime, but won't have
    // silent failures or cause problems down the road.
    const address = N.fromRaw((node: any));
    return description(address);
  }
  nodeTypes() {
    return [
      {name: "Blob", prefix: N._Prefix.blob},
      {name: "Commit", prefix: N._Prefix.commit},
      {name: "Tree", prefix: N._Prefix.tree},
      {name: "Tree entry", prefix: N._Prefix.treeEntry},
    ];
  }
  edgeTypes() {
    return [
      {
        forwardName: "has tree",
        backwardName: "owned by",
        prefix: E._Prefix.hasTree,
      },
      {
        forwardName: "has parent",
        backwardName: "is parent of",
        prefix: E._Prefix.hasParent,
      },
      {
        forwardName: "includes",
        backwardName: "is included by",
        prefix: E._Prefix.includes,
      },
      {
        forwardName: "evolves to",
        backwardName: "evolves from",
        prefix: E._Prefix.becomes,
      },
      {
        forwardName: "has contents",
        backwardName: "is contents of",
        prefix: E._Prefix.hasContents,
      },
    ];
  }
}
