// @flow

import type {RepoIdString} from "../github/repoId";

export type Repository = {|
  +commits: {[Hash]: Commit},
  // For every commit, track all the RepoIds of repos
  // containing this commit.
  +commitToRepoId: {[Hash]: {+[RepoIdString]: true}},
|};
export type MsSinceEpoch = number;
export type Hash = string;
export type Commit = {|
  +hash: Hash,
  +parentHashes: $ReadOnlyArray<Hash>,
  // a shorter version of the hash;
  // shortHash is not guaranteed unique.
  +shortHash: string,
  // The author date, not the committer date.
  // Rationale: the committer date can change e.g. when a commit is rebased,
  // so the author date better represents when the commit was actually created.
  +createdAt: MsSinceEpoch,
  +summary: string, // Oneline commit summary
|};
