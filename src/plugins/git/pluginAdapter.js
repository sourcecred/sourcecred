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
import type {RepoId} from "../../core/repoId";
import type {Repository} from "./types";

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
        name: "Commit",
        pluralName: "Commits",
        prefix: N.Prefix.commit,
        defaultWeight: 2,
      },
    ];
  }
  edgeTypes() {
    return [
      {
        forwardName: "has parent",
        backwardName: "is parent of",
        prefix: E.Prefix.hasParent,
        defaultForwardWeight: 1,
        defaultBackwardWeight: 1,
      },
    ];
  }
  async load(assets: Assets, repoId: RepoId): Promise<IDynamicPluginAdapter> {
    const baseUrl = `/api/v1/data/data/${repoId.owner}/${repoId.name}/git/`;
    async function loadGraph() {
      const url = assets.resolve(baseUrl + "graph.json");
      const response = await fetch(url);
      if (!response.ok) {
        return Promise.reject(response);
      }
      const json = await response.json();
      return Graph.fromJSON(json);
    }
    async function loadRepository(): Promise<Repository> {
      const url = assets.resolve(baseUrl + "repository.json");
      const response = await fetch(url);
      if (!response.ok) {
        return Promise.reject(response);
      }
      return await response.json();
    }
    const [graph, repository] = await Promise.all([
      loadGraph(),
      loadRepository(),
    ]);
    return new DynamicPluginAdapter(graph, repository);
  }
}

class DynamicPluginAdapter implements IDynamicPluginAdapter {
  +_graph: Graph;
  +_repository: Repository;
  constructor(graph: Graph, repository: Repository) {
    this._graph = graph;
    this._repository = repository;
  }
  graph() {
    return this._graph;
  }
  nodeDescription(node) {
    // This cast is unsound, and might throw at runtime, but won't have
    // silent failures or cause problems down the road.
    const address = N.fromRaw((node: any));
    return description(address, this._repository);
  }
  static() {
    return new StaticPluginAdapter();
  }
}
