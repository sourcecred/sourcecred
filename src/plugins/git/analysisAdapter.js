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
import {type Repository} from "./types";

export class BackendAdapterLoader implements IBackendAdapterLoader {
  declaration() {
    return declaration;
  }

  async load(
    sourcecredDirectory: string,
    repoId: RepoId
  ): Promise<AnalysisAdapter> {
    const dataDirectory = path.join(
      sourcecredDirectory,
      "data",
      repoIdToString(repoId),
      "git"
    );
    async function loadJson(filename) {
      const filepath = path.join(dataDirectory, filename);
      const rawData = await fs.readFile(filepath);
      return JSON.parse(rawData.toString());
    }
    const [graphJson, repository] = await Promise.all([
      loadJson("graph.json"),
      loadJson("repository.json"),
    ]);
    const graph = Graph.fromJSON(graphJson);
    return new AnalysisAdapter(graph, repository);
  }
}

export class AnalysisAdapter implements IAnalysisAdapter {
  _graph: Graph;
  _repository: Repository;
  constructor(graph: Graph, repository: Repository) {
    this._graph = graph;
    this._repository = repository;
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
