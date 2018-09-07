// @flow

import tmp from "tmp";

import {
  createExampleRepo,
  createExampleSubmoduleRepo,
  SUBMODULE_COMMIT_1,
  SUBMODULE_COMMIT_2,
} from "./exampleRepo";

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

describe("plugins/git/example/exampleRepo", () => {
  describe("createExampleRepo", () => {
    it("is deterministic", () => {
      expect(createExampleRepo(mkdtemp()).commits).toMatchSnapshot();
    });
  });

  describe("createExampleSubmoduleRepo", () => {
    it("is deterministic", () => {
      expect(createExampleSubmoduleRepo(mkdtemp()).commits).toMatchSnapshot();
    });

    it("includes all the SHAs that it should", () => {
      const commits = createExampleSubmoduleRepo(mkdtemp()).commits;
      expect(commits).toEqual(
        expect.arrayContaining([SUBMODULE_COMMIT_1, SUBMODULE_COMMIT_2])
      );
    });
  });
});
