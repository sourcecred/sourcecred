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
  +treeHash: Hash,
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

export const TREE_ENTRY_NODE_TYPE: "TREE_ENTRY" = "TREE_ENTRY";
export type TreeEntryNodePayload = {||};
export function treeEntryId(treeSha: string, name: string): string {
  return `${treeSha}:${name}`;
}

export type NodePayload =
  | CommitNodePayload
  | TreeNodePayload
  | TreeEntryNodePayload
  | HasContentsEdgePayload;

export type NodeType =
  | typeof COMMIT_NODE_TYPE
  | typeof TREE_NODE_TYPE
  | typeof TREE_ENTRY_NODE_TYPE
  | typeof BLOB_NODE_TYPE;

// Edges

// CommitNode -> TreeNode
export const HAS_TREE_EDGE_TYPE: "HAS_TREE" = "HAS_TREE";
export type HasTreeEdgePayload = {||};

// TreeNode -> TreeEntryNode
export const INCLUDES_EDGE_TYPE: "INCLUDES" = "INCLUDES";
export type IncludesEdgePayload = {||};
export function includesEdgeId(treeSha: string, name: string): string {
  return `${treeSha}:${name}`;
}

// TreeEntryNode -> TreeEntryNode
export const BECOMES_EDGE_TYPE: "BECOMES" = "BECOMES";
export type BecomesEdgePayload = {||};

// TreeEntryNode -> BlobNode | TreeNode
export const HAS_CONTENTS_EDGE_TYPE: "HAS_CONTENTS" = "HAS_CONTENTS";
export type HasContentsEdgePayload = {||};

export type EdgeType =
  | typeof HAS_TREE_EDGE_TYPE
  | typeof INCLUDES_EDGE_TYPE
  | typeof BECOMES_EDGE_TYPE
  | typeof HAS_CONTENTS_EDGE_TYPE;

export type EdgePayload =
  | HasTreeEdgePayload
  | IncludesEdgePayload
  | BecomesEdgePayload
  | HasContentsEdgePayload;
