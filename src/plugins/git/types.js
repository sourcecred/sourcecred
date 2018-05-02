// @flow

import stringify from "json-stable-stringify";

export const GIT_PLUGIN_NAME = "sourcecred/git-beta";

// Logical types
export type Repository = {|
  +commits: {[Hash]: Commit},
  +trees: {[Hash]: Tree},
|};
export type Hash = string;
export type Commit = {|
  +hash: Hash,
  +parentHashes: $ReadOnlyArray<Hash>,
  +treeHash: Hash,
  +submoduleUrls: {[path: string]: string},
|};
export type Tree = {|
  +hash: Hash,
  +entries: {[name: string]: TreeEntry},
|};
export type TreeEntry = {|
  +type: "blob" | "commit" | "tree",
  +name: string,
  +hash: Hash,
|};

// Graph types

// Nodes
export const COMMIT_NODE_TYPE: "COMMIT" = "COMMIT";
export type CommitNodePayload = {||};

export const TREE_NODE_TYPE: "TREE" = "TREE";
export type TreeNodePayload = {||};

export const BLOB_NODE_TYPE: "BLOB" = "BLOB";
export type BlobNodePayload = {||}; // we do not store the content

// In Git, a tree may point to a commit directly; in our graph, we have
// an explicit notion of "submodule commit", because, a priori, we do
// not know the repository to which the commit belongs. A submodule
// commit node stores the hash of the referent commit, as well as the
// URL to the subproject as listed in the .gitmodules file.
export const SUBMODULE_COMMIT_NODE_TYPE: "SUBMODULE_COMMIT" =
  "SUBMODULE_COMMIT";
export function submoduleCommitId(hash: Hash, submoduleUrl: string) {
  return `${submoduleUrl}@${hash}`;
}
export type SubmoduleCommitPayload = {|
  +hash: Hash,
  +url: string, // from .gitmodules file
|};

export const TREE_ENTRY_NODE_TYPE: "TREE_ENTRY" = "TREE_ENTRY";
export type TreeEntryNodePayload = {|
  +name: string,
|};
export function treeEntryId(tree: Hash, name: string): string {
  return `${tree}:${name}`;
}

export type NodePayload =
  | BlobNodePayload
  | CommitNodePayload
  | SubmoduleCommitPayload
  | TreeEntryNodePayload
  | TreeNodePayload;

export type NodeType =
  | typeof BLOB_NODE_TYPE
  | typeof COMMIT_NODE_TYPE
  | typeof SUBMODULE_COMMIT_NODE_TYPE
  | typeof TREE_ENTRY_NODE_TYPE
  | typeof TREE_NODE_TYPE;

// Edges

// CommitNode -> CommitNode
export const HAS_PARENT_EDGE_TYPE: "HAS_PARENT" = "HAS_PARENT";
export type HasParentEdgePayload = {|
  +parentIndex: number, // one-based
|};
export function hasParentEdgeId(
  childCommitHash: Hash,
  oneBasedParentIndex: number
) {
  if (
    !isFinite(oneBasedParentIndex) ||
    oneBasedParentIndex !== Math.floor(oneBasedParentIndex) ||
    oneBasedParentIndex < 1
  ) {
    throw new Error(
      "Expected positive integer parent index, " +
        `but got: ${String(oneBasedParentIndex)}`
    );
  }
  return `${childCommitHash}^${String(oneBasedParentIndex)}`;
}

// CommitNode -> TreeNode
export const HAS_TREE_EDGE_TYPE: "HAS_TREE" = "HAS_TREE";
export type HasTreeEdgePayload = {||};

// TreeNode -> TreeEntryNode
export const INCLUDES_EDGE_TYPE: "INCLUDES" = "INCLUDES";
export type IncludesEdgePayload = {|
  +name: string,
|};
export function includesEdgeId(treeSha: string, name: string): string {
  return `${treeSha}:${name}`;
}

// TreeEntryNode -> TreeEntryNode
export const BECOMES_EDGE_TYPE: "BECOMES" = "BECOMES";
export type BecomesEdgePayload = {|
  +childCommit: Hash,
  +parentCommit: Hash,
  +path: $ReadOnlyArray<string>,
|};
export function becomesEdgeId(
  childCommit: Hash,
  parentCommit: Hash,
  path: $ReadOnlyArray<string>
) {
  return stringify({childCommit, parentCommit, path});
}

// TreeEntryNode -> BlobNode | TreeNode
export const HAS_CONTENTS_EDGE_TYPE: "HAS_CONTENTS" = "HAS_CONTENTS";
export type HasContentsEdgePayload = {||};

export type EdgeType =
  | typeof HAS_TREE_EDGE_TYPE
  | typeof HAS_PARENT_EDGE_TYPE
  | typeof INCLUDES_EDGE_TYPE
  | typeof BECOMES_EDGE_TYPE
  | typeof HAS_CONTENTS_EDGE_TYPE;

export type EdgePayload =
  | HasTreeEdgePayload
  | HasParentEdgePayload
  | IncludesEdgePayload
  | BecomesEdgePayload
  | HasContentsEdgePayload;
