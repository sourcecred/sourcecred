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
      const submoduleUrls = loadSubmoduleUrls(git, hash);
      return {hash, parentHashes, treeHash, submoduleUrls};
    });
}

const GITMODULES_SUBMODULES_KEY_RE = /^submodule\.(.*)\.(path|url)$/;

function loadSubmoduleUrls(
  git: GitDriver,
  commitHash: Hash
): {[path: string]: string} {
  const gitmodulesRef = `${commitHash}:.gitmodules`;
  const gitmodulesBlob: string | null = (() => {
    try {
      return git(["rev-parse", "--quiet", "--verify", gitmodulesRef]).trim();
    } catch (e) {
      if (e.status === 1) {
        // No .gitmodules file here.
        return null;
      } else {
        throw e;
      }
    }
  })();
  if (gitmodulesBlob == null) {
    // No problem; there just weren't any submodules at this commit.
    return {};
  }

  // The output format of the following is `${key}\n${value}\0...`, as
  // specified in `git help config`'s section about the `-z` option.
  // The format is safe because keys are strictly validated; see the
  // function `git_config_parse_key` in `git/git:config.c`.
  const rawConfig = git(["config", "--blob", gitmodulesBlob, "--list", "-z"]);
  const configKeyValuePairs = rawConfig
    .split("\0")
    .filter((line) => line.length > 0)
    .map((line) => {
      const separator = line.indexOf("\n");
      if (separator < 0) {
        // Shouldn't happen, according to Git docs. Guard anyway.
        throw new Error(`Bad .gitmodules line at ${commitHash}: ${line}`);
      }
      return {
        key: line.substring(0, separator),
        value: line.substring(separator + 1),
      };
    });

  const submoduleInfoByKey: {
    [submoduleKey: string]: {path: string | null, url: string | null},
  } = {};
  configKeyValuePairs.forEach(({key, value}) => {
    const match = key.match(GITMODULES_SUBMODULES_KEY_RE);
    if (!match) {
      return;
    }
    const [_, submoduleKey, kind] = match;
    if (submoduleInfoByKey[submoduleKey] == null) {
      submoduleInfoByKey[submoduleKey] = {path: null, url: null};
    }
    if (kind !== "path" && kind !== "url") {
      throw new Error(`Invariant violation: bad kind: ${kind}`);
    }
    submoduleInfoByKey[submoduleKey][kind] = value;
  });

  const result = {};
  Object.keys(submoduleInfoByKey).forEach((submoduleKey) => {
    const {path, url} = submoduleInfoByKey[submoduleKey];
    if (path != null && url != null) {
      result[path] = url;
    } else {
      console.warn(`Partial submodule at ${commitHash}: ${submoduleKey}`);
    }
  });
  return result;
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
