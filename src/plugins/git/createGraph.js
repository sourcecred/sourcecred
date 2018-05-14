// @flow

import type {Edge, Node} from "@/core/graph";
import type {
  BecomesEdgePayload,
  BlobNodePayload,
  Commit,
  EdgePayload,
  HasContentsEdgePayload,
  Hash,
  IncludesEdgePayload,
  NodePayload,
  Repository,
  SubmoduleCommitPayload,
  Tree,
  TreeEntryNodePayload,
  TreeNodePayload,
} from "./types";
import {Graph, edgeID} from "@/core/graph";
import {
  BECOMES_EDGE_TYPE,
  BLOB_NODE_TYPE,
  COMMIT_NODE_TYPE,
  HAS_CONTENTS_EDGE_TYPE,
  HAS_PARENT_EDGE_TYPE,
  HAS_TREE_EDGE_TYPE,
  INCLUDES_EDGE_TYPE,
  SUBMODULE_COMMIT_NODE_TYPE,
  TREE_ENTRY_NODE_TYPE,
  TREE_NODE_TYPE,
  becomesEdgeId,
  hasParentEdgeId,
  includesEdgeId,
  submoduleCommitId,
  treeEntryId,
} from "./types";
import {_makeAddress} from "./address";

class GitGraphCreator {
  createGraph(repository: Repository): Graph<NodePayload, EdgePayload> {
    const treeAndNameToSubmoduleUrls = this.treeAndNameToSubmoduleUrls(
      repository
    );
    return Graph.mergeManyConservative([
      ...Object.keys(repository.commits).map((hash) =>
        this.commitGraph(repository.commits[hash])
      ),
      ...Object.keys(repository.trees).map((hash) =>
        this.treeGraph(repository.trees[hash], treeAndNameToSubmoduleUrls)
      ),
      this.becomesEdges(repository),
    ]);
  }

  treeAndNameToSubmoduleUrls(repository: Repository) {
    const result: {[tree: Hash]: {[name: string]: string[]}} = {};
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

  commitGraph(commit: Commit) {
    const commitNode = {
      address: _makeAddress(COMMIT_NODE_TYPE, commit.hash),
      payload: {},
    };
    const treeNode = {
      address: _makeAddress(TREE_NODE_TYPE, commit.treeHash),
      payload: {},
    };
    const hasTreeEdge = {
      address: _makeAddress(
        HAS_TREE_EDGE_TYPE,
        edgeID(commitNode.address, treeNode.address)
      ),
      src: commitNode.address,
      dst: treeNode.address,
      payload: {},
    };
    const result = new Graph()
      .addNode(commitNode)
      .addNode(treeNode)
      .addEdge(hasTreeEdge);
    commit.parentHashes.forEach((parentHash, index) => {
      const oneBasedParentIndex = index + 1;
      const parentAddress = _makeAddress(COMMIT_NODE_TYPE, parentHash);
      const parentEdge = {
        address: _makeAddress(
          HAS_PARENT_EDGE_TYPE,
          hasParentEdgeId(commit.hash, oneBasedParentIndex)
        ),
        src: commitNode.address,
        dst: parentAddress,
        payload: {
          parentIndex: oneBasedParentIndex,
        },
      };
      result.addEdge(parentEdge);
    });
    return result;
  }

  treeGraph(tree: Tree, treeAndNameToSubmoduleUrls) {
    const treeNode = {
      address: _makeAddress(TREE_NODE_TYPE, tree.hash),
      payload: {},
    };
    const result = new Graph().addNode(treeNode);
    Object.keys(tree.entries).forEach((name) => {
      const entry = tree.entries[name];
      const entryNode: Node<TreeEntryNodePayload> = {
        address: _makeAddress(
          TREE_ENTRY_NODE_TYPE,
          treeEntryId(tree.hash, entry.name)
        ),
        payload: {name},
      };
      const entryEdge: Edge<IncludesEdgePayload> = {
        address: _makeAddress(
          INCLUDES_EDGE_TYPE,
          includesEdgeId(tree.hash, entry.name)
        ),
        src: treeNode.address,
        dst: entryNode.address,
        payload: {name},
      };
      result.addNode(entryNode).addEdge(entryEdge);
      const contentsNodes: Node<NodePayload>[] = (() => {
        if (entry.type !== "commit") {
          let contentsNodeType;
          if (entry.type === "tree") {
            contentsNodeType = TREE_NODE_TYPE;
          } else if (entry.type === "blob") {
            contentsNodeType = BLOB_NODE_TYPE;
          } else {
            // eslint-disable-next-line no-unused-expressions
            (entry.type: empty);
            throw new Error(`Unknown entry type: ${entry.type}`);
          }
          const contentsNode: Node<TreeNodePayload> | Node<BlobNodePayload> = {
            address: _makeAddress(contentsNodeType, entry.hash),
            payload: (({}: any): {||}),
          };
          return [contentsNode];
        } else {
          // One entry for each possible URL.
          const urls = treeAndNameToSubmoduleUrls[tree.hash][name];
          return urls.map((url): Node<SubmoduleCommitPayload> => ({
            address: _makeAddress(
              SUBMODULE_COMMIT_NODE_TYPE,
              submoduleCommitId(entry.hash, url)
            ),
            payload: {
              hash: entry.hash,
              url,
            },
          }));
        }
      })();
      contentsNodes.forEach((contentsNode) => {
        const contentsEdge: Edge<HasContentsEdgePayload> = {
          address: _makeAddress(
            HAS_CONTENTS_EDGE_TYPE,
            edgeID(entryNode.address, contentsNode.address)
          ),
          src: entryNode.address,
          dst: contentsNode.address,
          payload: (({}: any): {||}),
        };
        result.addNode(contentsNode).addEdge(contentsEdge);
      });
    });
    return result;
  }

  becomesEdges(repository: Repository): Graph<NodePayload, EdgePayload> {
    const result = new Graph();
    for (const {
      childCommit,
      parentCommit,
      becomesEdge: {from, to, path},
    } of findBecomesEdges(repository)) {
      result.addEdge(
        ({
          address: _makeAddress(
            BECOMES_EDGE_TYPE,
            becomesEdgeId(childCommit, parentCommit, path)
          ),
          src: _makeAddress(
            TREE_ENTRY_NODE_TYPE,
            treeEntryId(from.tree, from.name)
          ),
          dst: _makeAddress(
            TREE_ENTRY_NODE_TYPE,
            treeEntryId(to.tree, to.name)
          ),
          payload: {childCommit, parentCommit, path},
        }: Edge<BecomesEdgePayload>)
      );
    }
    return result;
  }
}

export type BecomesEdge = {|
  +from: {|
    +tree: Hash,
    +name: string,
  |},
  +to: {|
    +tree: Hash,
    +name: string,
  |},
  +path: $ReadOnlyArray<string>,
|};

export function* findBecomesEdgesForCommits(
  repository: Repository,
  childCommit: Hash,
  parentCommit: Hash
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
  repository: Repository
): Iterator<{|
  +childCommit: Hash,
  +parentCommit: Hash,
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

export function createGraph(
  repository: Repository
): Graph<NodePayload, EdgePayload> {
  return new GitGraphCreator().createGraph(repository);
}
