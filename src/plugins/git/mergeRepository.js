// @flow

import deepEqual from "lodash.isequal";
import type {Repository} from "./types";

export function mergeRepository(
  repositories: $ReadOnlyArray<Repository>
): Repository {
  const newRepository = {commits: {}, trees: {}};
  for (const {trees, commits} of repositories) {
    for (const treeHash of Object.keys(trees)) {
      const existingTree = newRepository.trees[treeHash];
      if (existingTree != null && !deepEqual(existingTree, trees[treeHash])) {
        throw new Error(`Conflict between trees at ${treeHash}`);
      }
      newRepository.trees[treeHash] = trees[treeHash];
    }
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
