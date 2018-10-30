// @flow
import pako from "pako";

import type {
  StaticAppAdapter as IStaticAppAdapter,
  DynamicAppAdapter as IDynamicAppAdapter,
} from "../../app/adapters/appAdapter";
import {type Graph, NodeAddress} from "../../core/graph";
import {createGraph} from "./createGraph";
import * as N from "./nodes";
import {RelationalView} from "./relationalView";
import {description} from "./render";
import type {Assets} from "../../app/assets";
import type {RepoId} from "../../core/repoId";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import {declaration} from "./declaration";

export class StaticAppAdapter implements IStaticAppAdapter {
  declaration(): PluginDeclaration {
    return declaration;
  }
  async load(assets: Assets, repoId: RepoId): Promise<IDynamicAppAdapter> {
    const url = assets.resolve(
      `/api/v1/data/data/${repoId.owner}/${repoId.name}/github/view.json.gz`
    );
    const response = await fetch(url);
    if (!response.ok) {
      return Promise.reject(response);
    }
    const arrayBuffer = await response.arrayBuffer();
    const blob = new Uint8Array(arrayBuffer);
    const json = JSON.parse(pako.ungzip(blob, {to: "string"}));
    const view = RelationalView.fromJSON(json);
    const graph = createGraph(view);
    return new DynamicAppAdapter(view, graph);
  }
}

class DynamicAppAdapter implements IDynamicAppAdapter {
  +_view: RelationalView;
  +_graph: Graph;
  constructor(view: RelationalView, graph: Graph): void {
    this._view = view;
    this._graph = graph;
  }
  nodeDescription(node) {
    // This cast is unsound, and might throw at runtime, but won't have
    // silent failures or cause problems down the road.
    const address = N.fromRaw((node: any));
    const entity = this._view.entity(address);
    if (entity == null) {
      throw new Error(`unknown entity: ${NodeAddress.toString(node)}`);
    }
    return description(entity);
  }
  graph() {
    return this._graph;
  }
  static() {
    return new StaticAppAdapter();
  }
}
