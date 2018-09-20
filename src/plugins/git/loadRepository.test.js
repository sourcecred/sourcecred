// @flow

import tmp from "tmp";

import {createExampleRepo} from "./example/exampleRepo";
import {localGit} from "./gitUtils";
import {loadRepository} from "./loadRepository";

const cleanups: (() => void)[] = [];
afterAll(() => {
  cleanups.forEach((f) => {
    f();
  });
});

function mkdtemp() {
  const result = tmp.dirSync({unsafeCleanup: true});
  cleanups.push(() => result.removeCallback());
  return result.name;
}

describe("plugins/git/loadRepository", () => {
  it("loads from HEAD", () => {
    const repository = createExampleRepo(mkdtemp());
    // In case of failure, run
    //     src/plugins/git/loadRepositoryTest.sh --updateSnapshot
    // to update the snapshot, then inspect the resulting changes.
    expect(loadRepository(repository.path, "HEAD")).toEqual(
      require("./example/example-git.json")
    );
  });

  it("processes an old commit", () => {
    const repository = createExampleRepo(mkdtemp());
    const whole = loadRepository(repository.path, "HEAD");
    const part = loadRepository(repository.path, repository.commits[1]);

    // Check that `part` is a subset of `whole`...
    Object.keys(part.commits).forEach((hash) => {
      expect(part.commits[hash]).toEqual(whole.commits[hash]);
    });

    // ...and that it's the right subset.
    expect({
      commits: new Set(Object.keys(part.commits)),
    }).toMatchSnapshot();
  });

  it("fails when given a non-existent root ref", () => {
    const repository = createExampleRepo(mkdtemp());
    const invalidHash = "0".repeat(40);
    expect(() => {
      loadRepository(repository.path, invalidHash);
    }).toThrow("fatal: bad object 0000000000000000000000000000000000000000");
  });

  it("handles an empty repository properly", () => {
    const repositoryPath = mkdtemp();
    const git = localGit(repositoryPath);
    git(["init"]);
    expect(loadRepository(repositoryPath, "HEAD")).toEqual({
      commits: {},
    });
  });
});
