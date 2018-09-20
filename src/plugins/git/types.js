// @flow

export type Repository = {|
  +commits: {[Hash]: Commit},
|};
export type Hash = string;
export type Commit = {|
  +hash: Hash,
  +parentHashes: $ReadOnlyArray<Hash>,
  // a shorter version of the hash;
  // shortHash is not guaranteed unique.
  +shortHash: string,
  +summary: string, // Oneline commit summary
|};
