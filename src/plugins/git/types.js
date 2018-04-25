// @flow

export type Repository = {|
  +commits: Map<Hash, Commit>,
  +trees: Map<Hash, Tree>,
|};
export type Hash = string;
export type Commit = {|
  +hash: Hash,
  +treeHash: Hash,
|};
export type Tree = {|
  +hash: Hash,
  +entries: Map<string, TreeEntry>, // map from name
|};
export type TreeEntry = {|
  +type: "blob" | "commit" | "tree",
  +name: string,
  +hash: Hash,
|};
