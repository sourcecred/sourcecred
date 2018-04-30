// @flow

import type {Address} from "../../core/address";
import type {Node, Edge} from "../../core/graph";
import type {
  Repository,
  Commit,
  Tree,
  TreeEntry,
  NodePayload,
  EdgePayload,
  NodeType,
  EdgeType,
} from "./types";
import {Graph, edgeID} from "../../core/graph";
import {GIT_PLUGIN_NAME, includesEdgeId, treeEntryId} from "./types";

class GitGraphCreator {
  repositoryName: string;

  constructor(repositoryName) {
    this.repositoryName = repositoryName;
  }

  makeAddress(type: NodeType | EdgeType, id: string): Address {
    return {
      pluginName: GIT_PLUGIN_NAME,
      repositoryName: this.repositoryName,
      type,
      id,
    };
  }

  createGraph(repository: Repository): Graph<NodePayload, EdgePayload> {
    const graphs = [
      ...Object.keys(repository.commits).map((hash) =>
        this.commitGraph(repository.commits[hash])
      ),
      ...Object.keys(repository.trees).map((hash) =>
        this.treeGraph(repository.trees[hash])
      ),
    ];
    return graphs.reduce((g, h) => Graph.mergeConservative(g, h), new Graph());
  }

  commitGraph(commit: Commit) {
    const commitNode = {
      address: this.makeAddress("COMMIT", commit.hash),
      payload: {},
    };
    const treeNode = {
      address: this.makeAddress("TREE", commit.treeHash),
      payload: {},
    };
    const edge = {
      address: this.makeAddress(
        "HAS_TREE",
        edgeID(commitNode.address, treeNode.address)
      ),
      src: commitNode.address,
      dst: treeNode.address,
      payload: {},
    };
    return new Graph()
      .addNode(commitNode)
      .addNode(treeNode)
      .addEdge(edge);
  }

  treeGraph(tree: Tree) {
    const treeNode = {
      address: this.makeAddress("TREE", tree.hash),
      payload: {},
    };
    const result = new Graph().addNode(treeNode);
    Object.keys(tree.entries).forEach((name) => {
      const entry = tree.entries[name];
      const entryNode = {
        address: this.makeAddress(
          "TREE_ENTRY",
          treeEntryId(tree.hash, entry.name)
        ),
        payload: {},
      };
      const entryEdge = {
        address: this.makeAddress(
          "INCLUDES",
          includesEdgeId(tree.hash, entry.name)
        ),
        src: treeNode.address,
        dst: entryNode.address,
        payload: {},
      };
      result.addNode(entryNode).addEdge(entryEdge);
      if (entry.type === "commit") {
        // We don't represent subproject commits in the graph.
      } else {
        let contentsNodeType;
        if (entry.type === "tree") {
          contentsNodeType = "TREE";
        } else if (entry.type === "blob") {
          contentsNodeType = "BLOB";
        } else {
          (entry.type: empty);
          throw new Error(`Unknown entry type: ${entry.type}`);
        }
        const contentsNode = {
          address: this.makeAddress(contentsNodeType, entry.hash),
          payload: {},
        };
        const contentsEdge = {
          address: this.makeAddress(
            "HAS_CONTENTS",
            edgeID(entryNode.address, contentsNode.address)
          ),
          src: entryNode.address,
          dst: contentsNode.address,
          payload: {},
        };
        result.addNode(contentsNode).addEdge(contentsEdge);
      }
    });
    return result;
  }
}

export function createGraph(
  repository: Repository,
  repositoryName: string
): Graph<NodePayload, EdgePayload> {
  return new GitGraphCreator(repositoryName).createGraph(repository);
}
