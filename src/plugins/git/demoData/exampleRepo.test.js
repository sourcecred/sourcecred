// @flow

import tmp from "tmp";

import {createExampleRepo} from "./exampleRepo";

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

describe("createExampleRepo", () => {
  it("is deterministic", () => {
    expect(createExampleRepo(mkdtemp()).commits).toMatchSnapshot();
  });
});
