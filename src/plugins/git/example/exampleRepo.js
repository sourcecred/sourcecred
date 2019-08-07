// @flow

import tmp from "tmp";
import fs from "fs-extra";

import {makeUtils} from "../gitUtils";
import type {Hash} from "../types";

type RepositoryInfo = {|
  +path: string,
  +commits: $ReadOnlyArray<Hash>, // in oldest-to-newest order
|};

// For determinism, the example repository's submodule URL must be set
// to a fixed value. We choose the URL of the GitHub mirror (it's as
// good as any other, and makes sense).
export const SUBMODULE_REMOTE_URL =
  "https://github.com/sourcecred-test/example-git-submodule.git";

// The example repository checks out two different versions of the
// submodule, as given by the following two hashes. These must exist
// within the submodule; this property is checked by the test file for
// this module.
export const SUBMODULE_COMMIT_1: Hash =
  "762c062fbdc7ec198cd693e95d55b374a08ff3e3";
export const SUBMODULE_COMMIT_2: Hash =
  "29ef158bc982733e2ba429fcf73e2f7562244188";

/**
 * Create the main example repository.
 */
export function createExampleRepo(intoDirectory: string): RepositoryInfo {
  const repositoryPath = intoDirectory;
  fs.mkdirpSync(repositoryPath);
  const git = makeUtils(repositoryPath);
  const commits = [];
  function commit(message) {
    git.deterministicCommit(message);
    commits.push(git.head());
  }

  git.exec(["init"]);

  git.writeAndStage(
    "README.txt",
    [
      "example-git\n",
      "-----------\n\n",
      "This repository provides example data for the SourceCred Git plugin.\n",
      "Pay no attention to the contents behind the curtain.\n",
    ].join("")
  );
  commit("Initial commit");

  git.writeAndStage("science.txt", "Amazing physics going on...\n");
  commit("Add repository description");

  const tmpdir = tmp.dirSync({unsafeCleanup: true});
  const submoduleName = "pygravitydefier";
  createExampleSubmoduleRepo(tmpdir.name);
  git.exec(["submodule", "add", "--quiet", tmpdir.name, submoduleName]);
  // After cloning the submodule, we don't need it anymore.
  tmpdir.removeCallback();
  // We need all our commits to be deterministic, which means that the
  // submodule URL needs to be independent of the actual location on
  // disk (which may be, e.g., a temporary directory).
  git.exec([
    "config",
    "--file=.gitmodules",
    `submodule.${submoduleName}.url`,
    SUBMODULE_REMOTE_URL,
  ]);
  git.exec(["submodule", "sync", "--quiet"]);
  git.exec(["add", ".gitmodules"]);
  git.exec(["-C", submoduleName, "checkout", SUBMODULE_COMMIT_1, "--quiet"]);
  git.exec(["add", submoduleName]);
  commit("Add gravity defiance module");

  git.writeAndStage("src/index.py", "import antigravity\n");
  git.writeAndStage(
    "src/quantum_gravity.py",
    'raise NotImplementedError("TODO(physicists)")\n'
  );
  git.writeAndStage("TODOS.txt", "1. Resolve quantum gravity\n");
  commit("Discover gravity");

  git.exec(["-C", submoduleName, "checkout", SUBMODULE_COMMIT_2, "--quiet"]);
  git.exec(["add", submoduleName]);
  commit("Pull quantum gravity defiance from upstream");

  git.writeAndStage(
    "src/quantum_gravity.py",
    "import random\nif random.random() < 0.5:\n  import antigravity\n"
  );
  commit("Solve quantum gravity");

  git.exec(["rm", "TODOS.txt"]);
  commit("Clean up TODOS");

  git.writeAndStage("src/whatever.py", "import json\nprint('hello world')\n");
  commit("  This | has leading whitespace.");

  return {path: repositoryPath, commits};
}

/**
 * Create the example repository that should be included as a submodule
 * in a larger repository. (This repository does not itself have
 * submodules.)
 */
export function createExampleSubmoduleRepo(
  intoDirectory: string
): RepositoryInfo {
  const repositoryPath = intoDirectory;
  fs.mkdirpSync(repositoryPath);
  const git = makeUtils(repositoryPath);
  const commits = [];
  function commit(message) {
    git.deterministicCommit(message);
    commits.push(git.head());
  }

  git.exec(["init"]);

  git.writeAndStage(
    "README.txt",
    [
      "example-git-submodule\n",
      "---------------------\n\n",
      "This simple repository serves no purpose other than to be included as\n",
      "a submodule in a larger repository.\n",
    ].join("")
  );
  commit("Initial commit");

  git.writeAndStage("useless.txt", "Nothing to see here; move along.\n");
  commit("Add a file, so that we have multiple commits");

  return {path: repositoryPath, commits};
}
