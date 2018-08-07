// @flow
import type {
  StaticPluginAdapter as IStaticPluginAdapter,
  DynamicPluginAdapter as IDynamicPluginAdapater,
} from "../../app/pluginAdapter";
import {type Graph, NodeAddress} from "../../core/graph";
import {createGraph} from "./createGraph";
import * as N from "./nodes";
import * as E from "./edges";
import {RelationalView} from "./relationalView";
import {description} from "./render";
import type {Repo} from "../../core/repo";

export class StaticPluginAdapter implements IStaticPluginAdapter {
  name() {
    return "GitHub";
  }
  nodePrefix() {
    return N._Prefix.base;
  }
  edgePrefix() {
    return E._Prefix.base;
  }
  nodeTypes() {
    return [
      {name: "Repository", prefix: N._Prefix.repo, defaultWeight: 4},
      {name: "Issue", prefix: N._Prefix.issue, defaultWeight: 2},
      {name: "Pull request", prefix: N._Prefix.pull, defaultWeight: 4},
      {name: "Pull request review", prefix: N._Prefix.review, defaultWeight: 1},
      {name: "Comment", prefix: N._Prefix.comment, defaultWeight: 1},
      {name: "User", prefix: N._Prefix.userlike, defaultWeight: 1},
    ];
  }
  edgeTypes() {
    return [
      {
        forwardName: "authors",
        backwardName: "is authored by",
        prefix: E._Prefix.authors,
      },
      {
        forwardName: "has parent",
        backwardName: "has child",
        prefix: E._Prefix.hasParent,
      },
      {
        forwardName: "merges",
        backwardName: "is merged by",
        prefix: E._Prefix.mergedAs,
      },
      {
        forwardName: "references",
        backwardName: "is referenced by",
        prefix: E._Prefix.references,
      },
    ];
  }
  async load(repo: Repo): Promise<IDynamicPluginAdapater> {
    const url = `/api/v1/data/data/${repo.owner}/${repo.name}/github/view.json`;
    const response = await fetch(url);
    if (!response.ok) {
      return Promise.reject(response);
    }
    const json = await response.json();
    const view = RelationalView.fromJSON(json);
    const graph = createGraph(view);
    return new DynamicPluginAdapter(view, graph);
  }
}

class DynamicPluginAdapter implements IDynamicPluginAdapater {
  +_view: RelationalView;
  +_graph: Graph;
  constructor(view: RelationalView, graph: Graph) {
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
    return new StaticPluginAdapter();
  }
}
