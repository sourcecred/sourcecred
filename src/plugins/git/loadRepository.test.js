// @flow

import fs from "fs";
import mkdirp from "mkdirp";
import path from "path";
import tmp from "tmp";

import type {GitDriver} from "./loadRepository";
import {localGit, loadRepository} from "./loadRepository";

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

function deterministicCommit(git: GitDriver, message: string): void {
  git(
    [
      "-c",
      "user.name=Test Runner",
      "-c",
      "user.email=nobody@example.com",
      "commit",
      "-m",
      message,
    ],
    {
      env: {
        TZ: "UTC",
        GIT_AUTHOR_DATE: "2001-02-03T04:05:06",
        GIT_COMMITTER_DATE: "2002-03-04T05:06:07",
      },
    }
  );
}

function createRepository(): {path: string, commits: string[]} {
  const repositoryPath = mkdtemp();
  const git = localGit(repositoryPath);

  git(["init"]);

  function makeChangesAndCommit(
    message: string,
    changes: {[filename: string]: ?string}
  ): string /* commit SHA */ {
    Object.keys(changes).forEach((filename) => {
      const filepath = path.join(repositoryPath, filename);
      const dirpath = path.join(repositoryPath, path.dirname(filename));
      if (changes[filename] == null) {
        fs.unlinkSync(filepath);
        git(["rm", filename]);
      } else {
        const change = changes[filename];
        mkdirp.sync(dirpath);
        fs.writeFileSync(filepath, change);
        git(["add", filename]);
      }
    });
    deterministicCommit(git, message);
    return git(["rev-parse", "HEAD"]).trim();
  }

  const commit1 = makeChangesAndCommit("Initial commit", {
    "README.txt": "Amazing physics going on...\n",
  });
  const commit2 = makeChangesAndCommit("Discover gravity", {
    "src/index.py": "import antigravity\n",
    "src/quantum_gravity.py": 'raise NotImplementedError("TODO(physicists)")\n',
    "TODOS.txt": "1. Resolve quantum gravity\n",
  });
  const commit3 = makeChangesAndCommit("Solve quantum gravity", {
    "src/quantum_gravity.py":
      "import random\nif random.random() < 0.5:\n  import antigravity\n",
  });
  const commit4 = makeChangesAndCommit("Clean up TODOS", {
    "TODOS.txt": null,
  });

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
    const git = localGit(repositoryPath);

    const subproject = createRepository();

    git(["init"]);
    git(["submodule", "--quiet", "add", subproject.path, "physics"]);
    deterministicCommit(git, "Initial commit");

    const head = git(["rev-parse", "HEAD"]).trim();

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
