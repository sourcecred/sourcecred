// @flow

import {Graph} from "../../core/graph";

import * as GT from "./types";
import * as GN from "./nodes";
import * as GE from "./edges";

export function createGraph(repository: GT.Repository): Graph {
  const creator = new GraphCreator();
  creator.addRepository(repository);
  return creator.graph;
}

class GraphCreator {
  +graph: Graph;

  constructor() {
    this.graph = new Graph();
  }

  addRepository(repository: GT.Repository) {
    for (const commitHash of Object.keys(repository.commits)) {
      this.addCommit(repository.commits[commitHash]);
    }
  }

  addCommit(commit: GT.Commit) {
    const structuredAddress: GN.CommitAddress = {
      type: GN.COMMIT_TYPE,
      hash: commit.hash,
    };
    const address = GN.toRaw(structuredAddress);
    const description = commit.hash;
    this.graph.addNode({address, description, timestampMs: commit.createdAt});
    for (const parentHash of commit.parentHashes) {
      const parent: GN.CommitAddress = {type: GN.COMMIT_TYPE, hash: parentHash};
      this.graph.addEdge(
        GE.createEdge.hasParent(structuredAddress, parent, commit.createdAt)
      );
    }
  }
}
