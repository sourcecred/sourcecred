// @flow

import fs from "fs-extra";
import path from "path";
import {Graph, type NodeAddressT} from "../../core/graph";
import type {
  IAnalysisAdapter,
  IBackendAdapterLoader,
  MsSinceEpoch,
} from "../../analysis/analysisAdapter";
import {type RepoId, repoIdToString} from "../../core/repoId";
import {declaration} from "./declaration";
import {type Repository} from "./types";
import {type StructuredAddress, fromRaw} from "./nodes";

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
  createdAt(n: NodeAddressT): MsSinceEpoch | null {
    // Coerce the NodeAddressT into a Git plugin 'RawAddress'.
    // If this coercion is false (i.e. the AnalysisAdapter was passed a non-Git NodeAddress)
    // then this will throw a runtime error.
    const addr: StructuredAddress = fromRaw((n: any));
    switch (addr.type) {
      case "COMMIT":
        const hash = addr.hash;
        const commit = this._repository.commits[hash];
        if (commit == null) {
          // Possibly this commit was merged to a non-master branch.
          // It's a little hacky to return null. See #1163 for alternative
          // solutions.
          return null;
        }
        return commit.createdAt;
      default:
        throw new Error(`Unexpected type: ${(addr.type: empty)}`);
    }
  }
}
