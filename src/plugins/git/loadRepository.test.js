// @flow

import tmp from "tmp";

import {createExampleRepo} from "./demoData/exampleRepo";
import {makeUtils} from "./gitUtils";
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

describe("loadRepository", () => {
  it("loads from HEAD", () => {
    const repository = createExampleRepo(mkdtemp());
    expect(loadRepository(repository.path, "HEAD")).toMatchSnapshot();
  });

  it("processes an old commit", () => {
    const repository = createExampleRepo(mkdtemp());
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
});
