// @flow

export type Repository = {|
  +commits: {[Hash]: Commit},
|};
export type Hash = string;
export type Commit = {|
  +hash: Hash,
  +parentHashes: $ReadOnlyArray<Hash>,
|};
