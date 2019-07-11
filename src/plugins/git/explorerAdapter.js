// @flow
import type {
  StaticExplorerAdapter as IStaticExplorerAdapter,
  DynamicExplorerAdapter as IDynamicExplorerAdapter,
} from "../../explorer/legacy/adapters/explorerAdapter";
import {Graph} from "../../core/graph";
import * as N from "./nodes";
import {description} from "./render";
import type {Assets} from "../../webutil/assets";
import type {RepoId} from "../../core/repoId";
import type {Repository} from "./types";
import type {GitGateway} from "./gitGateway";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import {declaration} from "./declaration";

export class StaticExplorerAdapter implements IStaticExplorerAdapter {
  _gitGateway: GitGateway;

  constructor(gg: GitGateway): void {
    this._gitGateway = gg;
  }
  declaration(): PluginDeclaration {
    return declaration;
  }
  async load(assets: Assets, repoId: RepoId): Promise<IDynamicExplorerAdapter> {
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
    return new DynamicExplorerAdapter(this._gitGateway, graph, repository);
  }
}

class DynamicExplorerAdapter implements IDynamicExplorerAdapter {
  +_graph: Graph;
  +_repository: Repository;
  +_gitGateway: GitGateway;
  constructor(
    gitGateway: GitGateway,
    graph: Graph,
    repository: Repository
  ): void {
    this._graph = graph;
    this._repository = repository;
    this._gitGateway = gitGateway;
  }
  graph() {
    return this._graph;
  }
  nodeDescription(node) {
    // This cast is unsound, and might throw at runtime, but won't have
    // silent failures or cause problems down the road.
    const address = N.fromRaw((node: any));
    return description(address, this._repository, this._gitGateway);
  }
  static() {
    return new StaticExplorerAdapter(this._gitGateway);
  }
}
