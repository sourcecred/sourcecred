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
  graph: Graph;

  constructor() {
    this.graph = new Graph();
  }

  addNode(a: GN.StructuredAddress) {
    this.graph.addNode(GN.toRaw(a));
  }

  addRepository(repository: GT.Repository) {
    for (const treeHash of Object.keys(repository.trees)) {
      this.addTree(repository.trees[treeHash]);
    }
    for (const commitHash of Object.keys(repository.commits)) {
      this.addCommit(repository.commits[commitHash]);
    }
    this.addBecomesEdges(repository);
  }

  addCommit(commit: GT.Commit) {
    const node: GN.CommitAddress = {type: GN.COMMIT_TYPE, hash: commit.hash};
    const tree: GN.TreeAddress = {type: GN.TREE_TYPE, hash: commit.treeHash};
    this.graph.addNode(GN.toRaw(node));
    this.graph.addNode(GN.toRaw(tree));
    this.graph.addEdge(GE.createEdge.hasTree(node, tree));
    for (const parentHash of commit.parentHashes) {
      const parent: GN.CommitAddress = {type: GN.COMMIT_TYPE, hash: parentHash};
      this.graph.addNode(GN.toRaw(parent));
      this.graph.addEdge(GE.createEdge.hasParent(node, parent));
    }
  }

  addTree(tree: GT.Tree) {
    const treeNode: GN.TreeAddress = {type: GN.TREE_TYPE, hash: tree.hash};
    this.graph.addNode(GN.toRaw(treeNode));
    for (const name of Object.keys(tree.entries)) {
      const entry = tree.entries[name];
      const entryNode: GN.TreeEntryAddress = {
        type: GN.TREE_ENTRY_TYPE,
        treeHash: tree.hash,
        name: entry.name,
      };
      this.graph.addNode(GN.toRaw(entryNode));
      this.graph.addEdge(GE.createEdge.includes(treeNode, entryNode));
      let target: ?GN.TreeEntryContentsAddress = null;
      switch (entry.type) {
        case "blob":
          target = {type: GN.BLOB_TYPE, hash: entry.hash};
          break;
        case "tree":
          target = {type: GN.TREE_TYPE, hash: entry.hash};
          break;
        case "commit":
          // Submodule commit.
          target = {type: GN.COMMIT_TYPE, hash: entry.hash};
          break;
        default:
          throw new Error(String((entry.type: empty)));
      }
      this.graph.addNode(GN.toRaw(target));
      this.graph.addEdge(GE.createEdge.hasContents(entryNode, target));
    }
  }

  addBecomesEdges(repository: GT.Repository) {
    for (const {
      becomesEdge: {from, to},
    } of findBecomesEdges(repository)) {
      const was: GN.TreeEntryAddress = {
        type: GN.TREE_ENTRY_TYPE,
        treeHash: from.tree,
        name: from.name,
      };
      const becomes: GN.TreeEntryAddress = {
        type: GN.TREE_ENTRY_TYPE,
        treeHash: to.tree,
        name: to.name,
      };
      this.graph.addEdge(GE.createEdge.becomes(was, becomes));
    }
  }
}

export type BecomesEdge = {|
  +from: {|
    +tree: GT.Hash,
    +name: string,
  |},
  +to: {|
    +tree: GT.Hash,
    +name: string,
  |},
  +path: $ReadOnlyArray<string>,
|};

export function* findBecomesEdgesForCommits(
  repository: GT.Repository,
  childCommit: GT.Hash,
  parentCommit: GT.Hash
): Iterator<BecomesEdge> {
  const workUnits = [
    {
      path: [],
      beforeTreeHash: repository.commits[parentCommit].treeHash,
      afterTreeHash: repository.commits[childCommit].treeHash,
    },
  ];
  while (workUnits.length > 0) {
    const {path, beforeTreeHash, afterTreeHash} = workUnits.pop();
    const beforeTree = repository.trees[beforeTreeHash];
    const afterTree = repository.trees[afterTreeHash];
    for (const name of Object.keys(beforeTree.entries)) {
      if (!(name in afterTree.entries)) {
        continue;
      }
      const beforeEntry = beforeTree.entries[name];
      const afterEntry = afterTree.entries[name];
      const subpath = [...path, name];
      if (beforeEntry.hash !== afterEntry.hash) {
        yield {
          from: {tree: beforeTreeHash, name},
          to: {tree: afterTreeHash, name},
          path: subpath,
        };
      }
      if (beforeEntry.type === "tree" && afterEntry.type === "tree") {
        workUnits.push({
          path: subpath,
          beforeTreeHash: beforeEntry.hash,
          afterTreeHash: afterEntry.hash,
        });
      }
    }
  }
}

export function* findBecomesEdges(
  repository: GT.Repository
): Iterator<{|
  +childCommit: GT.Hash,
  +parentCommit: GT.Hash,
  +becomesEdge: BecomesEdge,
|}> {
  for (const childCommit of Object.keys(repository.commits)) {
    for (const parentCommit of repository.commits[childCommit].parentHashes) {
      for (const becomesEdge of findBecomesEdgesForCommits(
        repository,
        childCommit,
        parentCommit
      )) {
        yield {childCommit, parentCommit, becomesEdge};
      }
    }
  }
}
