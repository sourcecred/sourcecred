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

import * as MapUtil from "../../util/map";
import type {GitDriver} from "./gitUtils";
import type {Repository, Commit} from "./types";
import {localGit} from "./gitUtils";
import {repoIdToString, type RepoId, type RepoIdString} from "../github/repoId";

/**
 * Load a Git repository from disk into memory. The `rootRef` should be
 * a revision reference as accepted by `git rev-parse`: "HEAD" and
 * "origin/master" will be common, while a specific SHA or tag might be
 * used to fix a particular state of a repository.
 */
export function loadRepository(
  repositoryPath: string,
  rootRef: string,
  repoId: RepoId
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
    return {commits: {}, commitToRepoId: {}};
  }
  const rawCommits = findCommits(git, rootRef);
  const commits = MapUtil.toObject(new Map(rawCommits.map((x) => [x.hash, x])));
  const repoIdString = repoIdToString(repoId);
  const repoIdStringSet: () => {[RepoIdString]: true} = () => ({
    [((repoIdString: RepoIdString): any)]: true,
  });
  const commitToRepoId = MapUtil.toObject(
    new Map(rawCommits.map(({hash}) => [hash, repoIdStringSet()]))
  );
  return {commits, commitToRepoId};
}

function findCommits(git: GitDriver, rootRef: string): Commit[] {
  return git(["log", "--format=%H %h %at %P|%s", rootRef])
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const pipeLocation = line.indexOf("|");
      const first = line.slice(0, pipeLocation).trim();
      const summary = line.slice(pipeLocation + 1);
      const [hash, shortHash, authorDate, ...parentHashes] = first.split(" ");
      const createdAt = +authorDate * 1000;
      return {hash, shortHash, createdAt, summary, parentHashes};
    });
}
