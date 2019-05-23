// @flow

import fs from "fs-extra";
import path from "path";
import {Graph} from "../../core/graph";
import type {
  IAnalysisAdapter,
  IBackendAdapterLoader,
} from "../../analysis/analysisAdapter";
import {type RepoId, repoIdToString} from "../../core/repoId";
import {declaration} from "./declaration";

export class BackendAdapterLoader implements IBackendAdapterLoader {
  declaration() {
    return declaration;
  }

  async load(
    sourcecredDirectory: string,
    repoId: RepoId
  ): Promise<AnalysisAdapter> {
    const file = path.join(
      sourcecredDirectory,
      "data",
      repoIdToString(repoId),
      "git",
      "graph.json"
    );
    const rawData = await fs.readFile(file);
    const json = JSON.parse(rawData.toString());
    const graph = Graph.fromJSON(json);
    return new AnalysisAdapter(graph);
  }
}

export class AnalysisAdapter implements IAnalysisAdapter {
  _graph: Graph;
  constructor(graph: Graph) {
    this._graph = graph;
  }
  declaration() {
    return declaration;
  }
  graph(): Graph {
    // Copy for safety, as the AnalysisAdapter is storing the graph
    // directly in memory.
    // TODO(perf): Consider removing this copy if this becomes a perf
    // hotspot. If so, implement a do-not-modify flag and set it (for safety)
    return this._graph.copy();
  }
}
