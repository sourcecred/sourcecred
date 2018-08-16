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
import type {Repository, Hash, Commit, Tree, TreeEntry} from "./types";
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
  const commits = findCommits(git, rootRef);
  const trees = findTrees(git, new Set(commits.map((x) => x.treeHash)));
  return {commits: objectMap(commits), trees: objectMap(trees)};
}

function objectMap<T: {+hash: Hash}>(ts: $ReadOnlyArray<T>): {[Hash]: T} {
  const result = {};
  ts.forEach((t) => {
    result[t.hash] = t;
  });
  return result;
}

function findCommits(git: GitDriver, rootRef: string): Commit[] {
  return git(["log", "--oneline", "--pretty=%H %T %P", rootRef])
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const [hash, treeHash, ...parentHashes] = line.trim().split(" ");
      return {hash, parentHashes, treeHash};
    });
}

function findTrees(git: GitDriver, rootTrees: Set<Hash>): Tree[] {
  const result: Tree[] = [];
  const visited: Set<Hash> = new Set();
  const frontier: Set<Hash> = new Set(rootTrees);
  while (frontier.size > 0) {
    const next = frontier.values().next();
    if (next.done) {
      // Flow doesn't know that this is impossible, but it is.
      throw new Error("Impossible! `frontier` had positive size.");
    }
    const treeHash: Hash = next.value;
    visited.add(treeHash);
    frontier.delete(treeHash);
    const tree = loadTree(git, treeHash);
    result.push(tree);
    Object.keys(tree.entries).forEach((key) => {
      const entry = tree.entries[key];
      if (entry.type === "tree" && !visited.has(entry.hash)) {
        frontier.add(entry.hash);
      }
    });
  }
  return result;
}

function loadTree(git: GitDriver, treeHash: Hash): Tree {
  const entries: {[name: string]: TreeEntry} = {};
  git(["ls-tree", "--full-tree", "-z", treeHash])
    .split("\0")
    .filter((line) => line.length > 0)
    .forEach((line) => {
      // See `git help ls-tree`, section OUTPUT FORMAT, for details.
      const [metadata, name] = line.split("\t");
      const [_unused_mode, type, hash] = metadata.split(" ");
      if (type !== "blob" && type !== "commit" && type !== "tree") {
        throw new Error(
          `entry ${treeHash}[${JSON.stringify(name)}] ` +
            `has unexpected type "${type}"`
        );
      }
      entries[name] = {name, type, hash};
    });
  return {hash: treeHash, entries: entries};
}
