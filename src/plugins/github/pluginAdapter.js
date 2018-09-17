// @flow
import pako from "pako";

import type {
  StaticPluginAdapter as IStaticPluginAdapter,
  DynamicPluginAdapter as IDynamicPluginAdapater,
} from "../../app/adapters/pluginAdapter";
import {type Graph, NodeAddress} from "../../core/graph";
import {createGraph} from "./createGraph";
import * as N from "./nodes";
import * as E from "./edges";
import {RelationalView} from "./relationalView";
import {description} from "./render";
import type {Assets} from "../../app/assets";
import type {Repo} from "../../core/repo";

export class StaticPluginAdapter implements IStaticPluginAdapter {
  name() {
    return "GitHub";
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
        name: "Repository",
        pluralName: "Repositories",
        prefix: N.Prefix.repo,
        defaultWeight: 4,
      },
      {
        name: "Issue",
        pluralName: "Issues",
        prefix: N.Prefix.issue,
        defaultWeight: 2,
      },
      {
        name: "Pull request",
        pluralName: "Pull requests",
        prefix: N.Prefix.pull,
        defaultWeight: 4,
      },
      {
        name: "Pull request review",
        pluralName: "Pull request reviews",
        prefix: N.Prefix.review,
        defaultWeight: 1,
      },
      {
        name: "Comment",
        pluralName: "Comments",
        prefix: N.Prefix.comment,
        defaultWeight: 1,
      },
      {
        name: "User",
        pluralName: "Users",
        prefix: N.Prefix.user,
        defaultWeight: 1,
      },
      {
        name: "Bot",
        pluralName: "Bots",
        prefix: N.Prefix.bot,
        defaultWeight: 0.25,
      },
    ];
  }
  edgeTypes() {
    return [
      {
        forwardName: "authors",
        backwardName: "is authored by",
        defaultForwardWeight: 1 / 2,
        defaultBackwardWeight: 1,
        prefix: E.Prefix.authors,
      },
      {
        forwardName: "has parent",
        backwardName: "has child",
        defaultForwardWeight: 1,
        defaultBackwardWeight: 1 / 4,
        prefix: E.Prefix.hasParent,
      },
      {
        forwardName: "merges",
        backwardName: "is merged by",
        defaultForwardWeight: 1 / 2,
        defaultBackwardWeight: 1,
        prefix: E.Prefix.mergedAs,
      },
      {
        forwardName: "references",
        backwardName: "is referenced by",
        defaultForwardWeight: 1,
        defaultBackwardWeight: 1 / 16,
        prefix: E.Prefix.references,
      },
      {
        forwardName: "mentions author of",
        backwardName: "has author mentioned by",
        defaultForwardWeight: 1,
        // TODO(#811): Probably change this to 0
        defaultBackwardWeight: 1 / 32,
        prefix: E.Prefix.mentionsAuthor,
      },
      {
        forwardName: "reacted ❤️ to",
        backwardName: "got ❤️ from",
        defaultForwardWeight: 2,
        // TODO(#811): Probably change this to 0
        defaultBackwardWeight: 1 / 32,
        prefix: E.Prefix.reactsHeart,
      },
      {
        forwardName: "reacted 👍 to",
        backwardName: "got 👍 from",
        defaultForwardWeight: 1,
        // TODO(#811): Probably change this to 0
        defaultBackwardWeight: 1 / 32,
        prefix: E.Prefix.reactsThumbsUp,
      },
      {
        forwardName: "reacted 🎉 to",
        backwardName: "got 🎉 from",
        defaultForwardWeight: 4,
        // TODO(#811): Probably change this to 0
        defaultBackwardWeight: 1 / 32,
        prefix: E.Prefix.reactsHooray,
      },
    ];
  }
  async load(assets: Assets, repo: Repo): Promise<IDynamicPluginAdapater> {
    const url = assets.resolve(
      `/api/v1/data/data/${repo.owner}/${repo.name}/github/view.json.gz`
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
