// @flow

import deepEqual from "lodash.isequal";
import type {Repository} from "./types";

export function mergeRepository(
  repositories: $ReadOnlyArray<Repository>
): Repository {
  const newRepository = {commits: {}};
  for (const {commits} of repositories) {
    for (const commitHash of Object.keys(commits)) {
      const existingCommit = newRepository.commits[commitHash];
      if (
        existingCommit != null &&
        !deepEqual(existingCommit, commits[commitHash])
      ) {
        throw new Error(`Conflict between commits at ${commitHash}`);
      }
      newRepository.commits[commitHash] = commits[commitHash];
    }
  }
  return newRepository;
}
