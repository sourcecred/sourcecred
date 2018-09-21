// @flow

import type {RepoIdString} from "../../core/repoId";

export type Repository = {|
  +commits: {[Hash]: Commit},
  // For every commit, track all the RepoIds of repos
  // containing this commit.
  +commitToRepoId: {[Hash]: {+[RepoIdString]: true}},
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
