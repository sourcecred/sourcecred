// @flow

import {Graph} from "../core/graph";
import * as NullUtil from "../util/null";
import * as RepoIdRegistry from "../core/repoIdRegistry";
import {type RepoId} from "../core/repoId";

import type {IBackendAdapterLoader} from "./analysisAdapter";

/**
 * Module for loading a graph from a SOURCECRED_DIRECTORY.
 */

export type LoadGraphResult =
  | {|+status: "SUCCESS", +graph: Graph|}
  | {|+status: "REPO_NOT_LOADED"|}
  | {|+status: "PLUGIN_FAILURE", +pluginName: string, +error: Error|};

type GraphOrError =
  | {|+type: "GRAPH", +graph: Graph|}
  | {|+type: "ERROR", +pluginName: string, +error: Error|};

/**
 * Load a Graph from disk.
 *
 * Loads a combined graph by merging each adapter's graph.
 * Before this can succeed, every plugin represented in the adapter array
 * must have already downloaded and serialized data for the provided
 * repoId, e.g. by calling `sourcecred load REPO_ID`.
 */
export async function loadGraph(
  sourcecredDirectory: string,
  adapters: $ReadOnlyArray<IBackendAdapterLoader>,
  repoId: RepoId
): Promise<LoadGraphResult> {
  const registry = RepoIdRegistry.getRegistry(sourcecredDirectory);
  if (RepoIdRegistry.getEntry(registry, repoId) == null) {
    return {status: "REPO_NOT_LOADED"};
  }
  async function graphForAdapter(
    adapter: IBackendAdapterLoader
  ): Promise<GraphOrError> {
    try {
      const dynamicAdapter = await adapter.load(
        sourcecredDirectory,
        NullUtil.get(repoId)
      );
      const graph = dynamicAdapter.graph();
      return {type: "GRAPH", graph};
    } catch (e) {
      return {type: "ERROR", pluginName: adapter.declaration().name, error: e};
    }
  }
  const results: GraphOrError[] = await Promise.all(
    adapters.map(graphForAdapter)
  );
  const graphs: Graph[] = [];
  for (const r of results) {
    if (r.type === "ERROR") {
      return {
        status: "PLUGIN_FAILURE",
        pluginName: r.pluginName,
        error: r.error,
      };
    } else {
      graphs.push(r.graph);
    }
  }
  return {status: "SUCCESS", graph: Graph.merge(graphs)};
}
