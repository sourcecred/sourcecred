// @flow
import type {
  StaticPluginAdapter as IStaticPluginAdapter,
  DynamicPluginAdapter as IDynamicPluginAdapter,
} from "../../app/pluginAdapter";
import {Graph} from "../../core/graph";
import * as N from "./nodes";
import * as E from "./edges";
import {description} from "./render";

export class StaticPluginAdapter implements IStaticPluginAdapter {
  name() {
    return "Git";
  }
  nodePrefix() {
    return N._Prefix.base;
  }
  edgePrefix() {
    return E._Prefix.base;
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
  async load(
    repoOwner: string,
    repoName: string
  ): Promise<IDynamicPluginAdapter> {
    const url = `/api/v1/data/data/${repoOwner}/${repoName}/git/graph.json`;
    const response = await fetch(url);
    if (!response.ok) {
      return Promise.reject(response);
    }
    const json = await response.json();
    const graph = Graph.fromJSON(json);
    return new DynamicPluginAdapter(graph);
  }
}

class DynamicPluginAdapter implements IDynamicPluginAdapter {
  +_graph: Graph;
  constructor(graph: Graph) {
    this._graph = graph;
  }
  graph() {
    return this._graph;
  }
  nodeDescription(node) {
    // This cast is unsound, and might throw at runtime, but won't have
    // silent failures or cause problems down the road.
    const address = N.fromRaw((node: any));
    return description(address);
  }
  static() {
    return new StaticPluginAdapter();
  }
}
