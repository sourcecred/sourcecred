// @flow

import deepEqual from "lodash.isequal";

import type {Address} from "../../core/address";
import type {Edge, Node} from "../../core/graph";
import type {
  BecomesEdgePayload,
  BlobNodePayload,
  Commit,
  EdgePayload,
  EdgeType,
  HasContentsEdgePayload,
  Hash,
  IncludesEdgePayload,
  NodePayload,
  NodeType,
  Repository,
  SubmoduleCommitPayload,
  Tree,
  TreeEntryNodePayload,
  TreeNodePayload,
} from "./types";
import {Graph, edgeID} from "../../core/graph";
import {
  BECOMES_EDGE_TYPE,
  BLOB_NODE_TYPE,
  COMMIT_NODE_TYPE,
  GIT_PLUGIN_NAME,
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

class GitGraphCreator {
  makeAddress(type: NodeType | EdgeType, id: string): Address {
    return {
      pluginName: GIT_PLUGIN_NAME,
      type,
      id,
    };
  }

  createGraph(repository: Repository): Graph<NodePayload, EdgePayload> {
    const treeAndNameToSubmoduleUrls = this.treeAndNameToSubmoduleUrls(
      repository
    );
    const graphs = [
      ...Object.keys(repository.commits).map((hash) =>
        this.commitGraph(repository.commits[hash])
      ),
      ...Object.keys(repository.trees).map((hash) =>
        this.treeGraph(repository.trees[hash], treeAndNameToSubmoduleUrls)
      ),
    ];
    const base = graphs.reduce(
      (g, h) => Graph.mergeConservative(g, h),
      new Graph()
    );
    return Graph.mergeConservative(base, this.becomesEdges(base));
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
      address: this.makeAddress(COMMIT_NODE_TYPE, commit.hash),
      payload: {},
    };
    const treeNode = {
      address: this.makeAddress(TREE_NODE_TYPE, commit.treeHash),
      payload: {},
    };
    const hasTreeEdge = {
      address: this.makeAddress(
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
      const parentAddress = this.makeAddress(COMMIT_NODE_TYPE, parentHash);
      const parentEdge = {
        address: this.makeAddress(
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
      address: this.makeAddress(TREE_NODE_TYPE, tree.hash),
      payload: {},
    };
    const result = new Graph().addNode(treeNode);
    Object.keys(tree.entries).forEach((name) => {
      const entry = tree.entries[name];
      const entryNode: Node<TreeEntryNodePayload> = {
        address: this.makeAddress(
          TREE_ENTRY_NODE_TYPE,
          treeEntryId(tree.hash, entry.name)
        ),
        payload: {name},
      };
      const entryEdge: Edge<IncludesEdgePayload> = {
        address: this.makeAddress(
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
            address: this.makeAddress(contentsNodeType, entry.hash),
            payload: (({}: any): {||}),
          };
          return [contentsNode];
        } else {
          // One entry for each possible URL.
          const urls = treeAndNameToSubmoduleUrls[tree.hash][name];
          return urls.map((url): Node<SubmoduleCommitPayload> => ({
            address: this.makeAddress(
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
          address: this.makeAddress(
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

  /**
   * Create a graph containing the BECOMES edges that should appear in
   * the provided graph. The provided graph is not mutated.
   */
  becomesEdges(
    graph: Graph<NodePayload, EdgePayload>
  ): Graph<empty, BecomesEdgePayload> {
    return []
      .concat(
        ...graph
          .nodes({type: COMMIT_NODE_TYPE})
          .map(({address: childCommit}) => {
            return graph
              .neighborhood(childCommit, {
                edgeType: HAS_PARENT_EDGE_TYPE,
                direction: "OUT",
              })
              .map(({neighbor: parentCommit}) => ({childCommit, parentCommit}));
          })
      )
      .map(({childCommit, parentCommit}) =>
        this.becomesEdgesForCommits(graph, childCommit, parentCommit)
      )
      .reduce((g, h) => Graph.mergeConservative(g, h), new Graph());
  }

  /**
   * Create a graph containing the BECOMES edges that indicate changes
   * from the given parent commit to the given child commit.
   */
  becomesEdgesForCommits(
    graph: Graph<NodePayload, EdgePayload>,
    childCommit: Address,
    parentCommit: Address
  ): Graph<empty, BecomesEdgePayload> {
    // Find a commit's tree, as `git rev-parse ${commitAddress}^{tree}`.
    function uniqueTreeOfCommit(commitAddress: Address): Address {
      const trees = graph.neighborhood(commitAddress, {
        edgeType: HAS_TREE_EDGE_TYPE,
      });
      if (trees.length !== 1) {
        const {id} = commitAddress;
        throw new Error(
          `expected exactly one tree, but found ${trees.length} at ${id}`
        );
      }
      return trees[0].neighbor;
    }

    // Collect the INCLUDES edges out of a Tree node, indexed by entry
    // name.
    function inclusionsByName(
      tree: Address
    ): Map<string, Edge<IncludesEdgePayload>> {
      return new Map(
        graph
          .neighborhood(tree, {
            edgeType: INCLUDES_EDGE_TYPE,
            direction: "OUT",
          })
          .map(({edge}) => {
            const typedEdge: Edge<IncludesEdgePayload> = (edge: Edge<any>);
            return [typedEdge.payload.name, typedEdge];
          })
      );
    }

    // Find all contents of an INCLUDES edge. For subtrees and blobs,
    // the result should have length exactly 1; for submodule commits,
    // there may be zero or more entries.
    function contentses(edge: Edge<IncludesEdgePayload>): Address[] {
      return graph
        .neighborhood(edge.dst, {
          edgeType: HAS_CONTENTS_EDGE_TYPE,
          direction: "OUT",
        })
        .map(({neighbor}) => neighbor);
    }

    const result = new Graph();
    const workUnits = [
      {
        path: [],
        beforeTree: uniqueTreeOfCommit(parentCommit),
        afterTree: uniqueTreeOfCommit(childCommit),
      },
    ];

    while (workUnits.length > 0) {
      const {path, beforeTree, afterTree} = workUnits.pop();
      const beforeInclusions = inclusionsByName(beforeTree);
      const afterInclusions = inclusionsByName(afterTree);
      for (const name of beforeInclusions.keys()) {
        if (!afterInclusions.has(name)) {
          continue;
        }
        const beforeInclusion = beforeInclusions.get(name);
        const afterInclusion = afterInclusions.get(name);
        if (beforeInclusion == null || afterInclusion == null) {
          // (Flow doesn't know what `Map.prototype.has` does.)
          throw new Error("Not possible.");
        }
        const subpath = [...path, name];
        const beforeContentses = contentses(beforeInclusion);
        const afterContentses = contentses(afterInclusion);

        // Add an edge from `b` to `a` for each `(b, a)` in the
        // cartesian product. Why this semantics? First, note that if
        // the entries are blobs or subtrees (the vast majority of
        // cases), then the cartesian product has size exactly 1, and we
        // create the obvious unique edge. This only becomes interesting
        // in the case of submodules. An alternate semantics would be to
        // only create edges between submodule commits with identical
        // URLs---but then we break the chain of BECOMES edges when the
        // URL of a repository is changed, which seems incorrect.
        // Working over the product solves this problem, and also seems
        // like a reasonable thing to do in principle.
        beforeContentses.forEach((beforeContents) => {
          afterContentses.forEach((afterContents) => {
            if (deepEqual(beforeContents, afterContents)) {
              // Unchanged blob, subcommit, or subtree. No edges to add.
              return;
            }
            result.addEdge({
              address: this.makeAddress(
                BECOMES_EDGE_TYPE,
                becomesEdgeId(childCommit.id, parentCommit.id, subpath)
              ),
              src: beforeInclusion.dst,
              dst: afterInclusion.dst,
              payload: {
                childCommit: childCommit.id,
                parentCommit: parentCommit.id,
                path: subpath,
              },
            });
            if (
              beforeContents.type === TREE_NODE_TYPE &&
              afterContents.type === TREE_NODE_TYPE
            ) {
              workUnits.push({
                path: subpath,
                beforeTree: beforeContents,
                afterTree: afterContents,
              });
            }
          });
        });
      }
    }
    return result;
  }
}

export function createGraph(
  repository: Repository
): Graph<NodePayload, EdgePayload> {
  return new GitGraphCreator().createGraph(repository);
}
