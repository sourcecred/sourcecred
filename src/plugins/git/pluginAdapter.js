// @flow
import type {
  StaticPluginAdapter as IStaticPluginAdapter,
  DynamicPluginAdapter as IDynamicPluginAdapter,
} from "../../app/adapters/pluginAdapter";
import {Graph} from "../../core/graph";
import * as N from "./nodes";
import * as E from "./edges";
import {description} from "./render";
import type {Assets} from "../../app/assets";
import type {Repo} from "../../core/repo";

export class StaticPluginAdapter implements IStaticPluginAdapter {
  name() {
    return "Git";
  }
  nodePrefix() {
    return N.Prefix.base;
  }
  edgePrefix() {
    return E.Prefix.base;
  }
  nodeTypes() {
    return [
      {
        name: "Blob",
        pluralName: "Blobs",
        prefix: N.Prefix.blob,
        defaultWeight: 0.125,
      },
      {
        name: "Commit",
        pluralName: "Commits",
        prefix: N.Prefix.commit,
        defaultWeight: 2,
      },
      {
        name: "Tree",
        pluralName: "Trees",
        prefix: N.Prefix.tree,
        defaultWeight: 0.125,
      },
      {
        name: "Tree entry",
        pluralName: "Tree entries",
        prefix: N.Prefix.treeEntry,
        defaultWeight: 0.125,
      },
    ];
  }
  edgeTypes() {
    return [
      {
        forwardName: "has tree",
        backwardName: "owned by",
        defaultForwardWeight: 1,
        defaultBackwardWeight: 1,
        prefix: E.Prefix.hasTree,
      },
      {
        forwardName: "has parent",
        backwardName: "is parent of",
        defaultForwardWeight: 1,
        defaultBackwardWeight: 1,
        prefix: E.Prefix.hasParent,
      },
      {
        forwardName: "includes",
        backwardName: "is included by",
        defaultForwardWeight: 1,
        defaultBackwardWeight: 1,
        prefix: E.Prefix.includes,
      },
      {
        forwardName: "evolves to",
        backwardName: "evolves from",
        defaultForwardWeight: 1,
        defaultBackwardWeight: 1,
        prefix: E.Prefix.becomes,
      },
      {
        forwardName: "has contents",
        backwardName: "is contents of",
        defaultForwardWeight: 1,
        defaultBackwardWeight: 1,
        prefix: E.Prefix.hasContents,
      },
    ];
  }
  async load(assets: Assets, repo: Repo): Promise<IDynamicPluginAdapter> {
    const url = assets.resolve(
      `/api/v1/data/data/${repo.owner}/${repo.name}/git/graph.json`
    );
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
