// @flow

import tmp from "tmp";

import {makeUtils} from "./gitUtils";
import {loadRepository} from "./loadRepository";

const cleanups: (() => void)[] = [];
afterAll(() => {
  cleanups.forEach((f) => {
    f();
  });
});

function mkdtemp() {
  const result = tmp.dirSync();
  cleanups.push(() => result.removeCallback());
  return result.name;
}

function createRepository(): {path: string, commits: string[]} {
  const repositoryPath = mkdtemp();
  const git = makeUtils(repositoryPath);

  git.exec(["init"]);

  git.writeAndStage("README.txt", "Amazing physics going on...\n");
  git.deterministicCommit("Initial commit");
  const commit1 = git.head();

  git.writeAndStage("src/index.py", "import antigravity\n");
  git.writeAndStage(
    "src/quantum_gravity.py",
    'raise NotImplementedError("TODO(physicists)")\n'
  );
  git.writeAndStage("TODOS.txt", "1. Resolve quantum gravity\n");
  git.deterministicCommit("Discover gravity");
  const commit2 = git.head();

  git.writeAndStage(
    "src/quantum_gravity.py",
    "import random\nif random.random() < 0.5:\n  import antigravity\n"
  );
  git.deterministicCommit("Solve quantum gravity");
  const commit3 = git.head();

  git.exec(["rm", "TODOS.txt"]);
  git.deterministicCommit("Clean up TODOS");
  const commit4 = git.head();

  return {
    path: repositoryPath,
    commits: [commit1, commit2, commit3, commit4],
  };
}

test("we create a deterministic repository", () => {
  expect(createRepository().commits).toMatchSnapshot();
});

describe("loadRepository", () => {
  it("loads from HEAD", () => {
    const repository = createRepository();
    expect(loadRepository(repository.path, "HEAD")).toMatchSnapshot();
  });

  it("processes an old commit", () => {
    const repository = createRepository();
    const whole = loadRepository(repository.path, "HEAD");
    const part = loadRepository(repository.path, repository.commits[1]);

    // Check that `part` is a subset of `whole`...
    for (const hash of part.commits.keys()) {
      expect(part.commits.get(hash)).toEqual(whole.commits.get(hash));
    }
    for (const hash of part.trees.keys()) {
      expect(part.trees.get(hash)).toEqual(whole.trees.get(hash));
    }

    // ...and that it's the right subset.
    expect({
      commits: new Set(part.commits.keys()),
      trees: new Set(part.trees.keys()),
    }).toMatchSnapshot();
  });

  it("works with submodules", () => {
    const repositoryPath = mkdtemp();
    const git = makeUtils(repositoryPath);

    const subproject = createRepository();

    git.exec(["init"]);
    git.exec(["submodule", "--quiet", "add", subproject.path, "physics"]);
    git.deterministicCommit("Initial commit");

    const head = git.head();

    const repository = loadRepository(repositoryPath, "HEAD");
    const commit = repository.commits.get(head);
    expect(commit).toEqual(expect.anything());
    if (commit == null) {
      throw new Error("Unreachable");
    }
    const tree = repository.trees.get(commit.treeHash);
    expect(tree).toEqual(expect.anything());
    if (tree == null) {
      throw new Error("Unreachable");
    }
    expect(tree.entries.get("physics")).toEqual({
      type: "commit",
      name: "physics",
      hash: subproject.commits[subproject.commits.length - 1],
    });
  });
});
