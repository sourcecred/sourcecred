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
    const treeAndNameToSubmoduleUrls = this.treeAndNameToSubmoduleUrls(
      repository
    );
    for (const treeHash of Object.keys(repository.trees)) {
      this.addTree(repository.trees[treeHash], treeAndNameToSubmoduleUrls);
    }
    for (const commitHash of Object.keys(repository.commits)) {
      this.addCommit(repository.commits[commitHash]);
    }
    this.addBecomesEdges(repository);
  }

  treeAndNameToSubmoduleUrls(repository: GT.Repository) {
    const result: {[tree: GT.Hash]: {[name: string]: string[]}} = {};
    Object.keys(repository.commits).forEach((commitHash) => {
      const {treeHash: rootTreeHash, submoduleUrls} = repository.commits[
        commitHash
      ];
      Object.keys(submoduleUrls).forEach((path) => {
        const parts = path.split("/");
        const [treePath, name] = [
          parts.slice(0, parts.length - 1),
          parts[parts.length - 1],
        ];
        let tree = repository.trees[rootTreeHash];
        for (const pathComponent of treePath) {
          tree = repository.trees[tree.entries[pathComponent].hash];
          if (tree == null) {
            return;
          }
        }
        if (result[tree.hash] == null) {
          result[tree.hash] = {};
        }
        const url = submoduleUrls[path];
        if (result[tree.hash][name] == null) {
          result[tree.hash][name] = [];
        }
        result[tree.hash][name].push(url);
      });
    });
    return result;
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

  addTree(tree: GT.Tree, treeAndNameToSubmoduleUrls) {
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
      let targets: GN.TreeEntryContentsAddress[] = [];
      switch (entry.type) {
        case "blob":
          targets.push({type: GN.BLOB_TYPE, hash: entry.hash});
          break;
        case "tree":
          targets.push({type: GN.TREE_TYPE, hash: entry.hash});
          break;
        case "commit":
          // One entry for each possible URL.
          const urls = treeAndNameToSubmoduleUrls[tree.hash][name];
          for (const url of urls) {
            targets.push({
              type: GN.SUBMODULE_COMMIT_TYPE,
              submoduleUrl: url,
              commitHash: entry.hash,
            });
          }
          break;
        default:
          // eslint-disable-next-line no-unused-expressions
          (entry.type: empty);
          throw new Error(String(entry.type));
      }
      for (const target of targets) {
        this.graph.addNode(GN.toRaw(target));
        this.graph.addEdge(GE.createEdge.hasContents(entryNode, target));
      }
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
