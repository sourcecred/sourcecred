// @flow

import {Graph} from "../../core/graph";

import * as GT from "./types";
import * as GN from "./nodes";
import * as GE from "./edges";

export function createMinimalGraph(repository: GT.Repository): Graph {
  const creator = new MinimalGraphCreator();
  creator.addRepository(repository);
  return creator.graph;
}

class MinimalGraphCreator {
  +graph: Graph;

  constructor() {
    this.graph = new Graph();
  }

  addNode(a: GN.StructuredAddress) {
    this.graph.addNode(GN.toRaw(a));
  }

  addRepository(repository: GT.Repository) {
    for (const commitHash of Object.keys(repository.commits)) {
      this.addCommit(repository.commits[commitHash]);
    }
  }

  addCommit(commit: GT.Commit) {
    const node: GN.CommitAddress = {type: GN.COMMIT_TYPE, hash: commit.hash};
    this.graph.addNode(GN.toRaw(node));
    for (const parentHash of commit.parentHashes) {
      const parent: GN.CommitAddress = {type: GN.COMMIT_TYPE, hash: parentHash};
      this.graph.addNode(GN.toRaw(parent));
      this.graph.addEdge(GE.createEdge.hasParent(node, parent));
    }
  }
}
