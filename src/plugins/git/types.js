// @flow

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
