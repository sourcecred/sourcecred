// @flow

import tmp from "tmp";

import {makeRepoId, repoIdToString} from "../github/repoId";
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
  // Disabled while we dont have facilities for actually loading the git plugin
  it.skip("loads from HEAD", () => {
    const repository = createExampleRepo(mkdtemp());
    // In case of failure, run
    //     src/plugins/git/loadRepositoryTest.sh --updateSnapshot
    // to update the snapshot, then inspect the resulting changes.
    expect(
      loadRepository(
        repository.path,
        "HEAD",
        makeRepoId("sourcecred-test", "example-git")
      )
    ).toEqual(require("./example/example-git.json"));
  });

  it("sets the right repoId for every commit", () => {
    const gitRepository = createExampleRepo(mkdtemp());
    const repoId = makeRepoId("sourcecred-test", "example-git");
    const repository = loadRepository(gitRepository.path, "HEAD", repoId);
    for (const commitHash of Object.keys(repository.commits)) {
      expect(Object.keys(repository.commitToRepoId[commitHash])).toEqual([
        repoIdToString(repoId),
      ]);
    }
  });

  it("processes an old commit", () => {
    const repository = createExampleRepo(mkdtemp());
    const whole = loadRepository(
      repository.path,
      "HEAD",
      makeRepoId("sourcecred-test", "example-git")
    );
    const part = loadRepository(
      repository.path,
      repository.commits[1],
      makeRepoId("sourcecred-test", "example-git")
    );

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
      loadRepository(
        repository.path,
        invalidHash,
        makeRepoId("sourcecred-test", "example-git")
      );
    }).toThrow("fatal: bad object 0000000000000000000000000000000000000000");
    expect.assertions(1);
  });

  it("handles an empty repository properly", () => {
    const repositoryPath = mkdtemp();
    const git = localGit(repositoryPath);
    git(["init"]);
    expect(
      loadRepository(
        repositoryPath,
        "HEAD",
        makeRepoId("sourcecred-test", "example-git")
      )
    ).toEqual({
      commits: {},
      commitToRepoId: {},
    });
  });
});
