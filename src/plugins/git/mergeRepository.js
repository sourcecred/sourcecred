// @flow

import deepEqual from "lodash.isequal";
import type {Repository} from "./types";

export function mergeRepository(
  repositories: $ReadOnlyArray<Repository>
): Repository {
  const newCommits = {};
  const newCommitToRepoId = {};
  for (const {commits, commitToRepoId} of repositories) {
    for (const commitHash of Object.keys(commits)) {
      const existingCommit = newCommits[commitHash];
      if (
        existingCommit != null &&
        !deepEqual(existingCommit, commits[commitHash])
      ) {
        throw new Error(`Conflict between commits at ${commitHash}`);
      }
      newCommits[commitHash] = commits[commitHash];
      const newRepos = commitToRepoId[commitHash];
      const existingRepos = newCommitToRepoId[commitHash] || {};
      const combinedRepoIdsForCommit = {...newRepos, ...existingRepos};
      newCommitToRepoId[commitHash] = combinedRepoIdsForCommit;
    }
  }
  return {commits: newCommits, commitToRepoId: newCommitToRepoId};
}
