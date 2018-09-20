/*
 * Load a git repository into memory. This dumps the commit and tree
 * data into a structured form. Contents of blobs are not loaded.
 *
 * If the repository contains file names that are not valid UTF-8
 * strings, the result is undefined.
 *
 * Note: git(1) is a runtime dependency of this module.
 */
// @flow

import type {GitDriver} from "./gitUtils";
import type {Repository, Hash, Commit} from "./types";
import {localGit} from "./gitUtils";

/**
 * Load a Git repository from disk into memory. The `rootRef` should be
 * a revision reference as accepted by `git rev-parse`: "HEAD" and
 * "origin/master" will be common, while a specific SHA or tag might be
 * used to fix a particular state of a repository.
 */
export function loadRepository(
  repositoryPath: string,
  rootRef: string
): Repository {
  const git = localGit(repositoryPath);
  try {
    // If the repository is empty, HEAD will not exist. We check HEAD
    // rather than the provided `rootRef` because, in the case where the
    // repository is non-empty but the provided `rootRef` does not
    // exist, we still want to fail.
    git(["rev-parse", "--verify", "HEAD"]);
  } catch (e) {
    // No data in the repository.
    return {commits: {}};
  }
  const commits = findCommits(git, rootRef);
  return {commits: objectMap(commits)};
}

function objectMap<T: {+hash: Hash}>(ts: $ReadOnlyArray<T>): {[Hash]: T} {
  const result = {};
  ts.forEach((t) => {
    result[t.hash] = t;
  });
  return result;
}

function findCommits(git: GitDriver, rootRef: string): Commit[] {
  return git(["log", "--format=%H %h %P|%s", rootRef])
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const pipeLocation = line.indexOf("|");
      const first = line.slice(0, pipeLocation).trim();
      const summary = line.slice(pipeLocation + 1);
      const [hash, shortHash, ...parentHashes] = first.split(" ");
      return {hash, shortHash, summary, parentHashes};
    });
}
