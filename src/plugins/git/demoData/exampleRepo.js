// @flow

import mkdirp from "mkdirp";

import {makeUtils} from "../gitUtils";
import type {Hash} from "../types";

type RepositoryInfo = {|
  +path: string,
  +commits: $ReadOnlyArray<Hash>, // in oldest-to-newest order
|};

export function createExampleRepo(intoDirectory: string): RepositoryInfo {
  const repositoryPath = intoDirectory;
  mkdirp(repositoryPath);
  const git = makeUtils(repositoryPath);
  const commits = [];

  git.exec(["init"]);

  git.writeAndStage("README.txt", "Amazing physics going on...\n");
  git.deterministicCommit("Initial commit");
  commits.push(git.head());

  git.writeAndStage("src/index.py", "import antigravity\n");
  git.writeAndStage(
    "src/quantum_gravity.py",
    'raise NotImplementedError("TODO(physicists)")\n'
  );
  git.writeAndStage("TODOS.txt", "1. Resolve quantum gravity\n");
  git.deterministicCommit("Discover gravity");
  commits.push(git.head());

  git.writeAndStage(
    "src/quantum_gravity.py",
    "import random\nif random.random() < 0.5:\n  import antigravity\n"
  );
  git.deterministicCommit("Solve quantum gravity");
  commits.push(git.head());

  git.exec(["rm", "TODOS.txt"]);
  git.deterministicCommit("Clean up TODOS");
  commits.push(git.head());

  return {path: repositoryPath, commits};
}
