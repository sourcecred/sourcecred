// @flow

import {
  toJSON,
  fromJSON,
  addRepoId,
  emptyRegistry,
  type RepoIdRegistry,
} from "./repoIdRegistry";

import {makeRepoId} from "../core/repoId";

describe("explorer/repoIdRegistry", () => {
  describe("fromJSON compose on", () => {
    function checkExample(x: RepoIdRegistry) {
      expect(fromJSON(toJSON(x))).toEqual(x);
      expect(toJSON(fromJSON(toJSON(x)))).toEqual(toJSON(x));
    }
    it("empty registry", () => {
      checkExample(emptyRegistry());
    });
    it("nonempty registry", () => {
      checkExample([makeRepoId("foo", "bar"), makeRepoId("zoo", "zod")]);
    });
  });
  describe("addRepoId", () => {
    it("adds to empty registry", () => {
      expect(addRepoId(makeRepoId("foo", "bar"), emptyRegistry())).toEqual([
        makeRepoId("foo", "bar"),
      ]);
    });
    it("adds to nonempty registry", () => {
      const registry = [makeRepoId("foo", "bar")];
      expect(addRepoId(makeRepoId("zoo", "zod"), registry)).toEqual([
        makeRepoId("foo", "bar"),
        makeRepoId("zoo", "zod"),
      ]);
    });
    it("adding repoId that is already the last has no effect", () => {
      const registry = [makeRepoId("zoo", "zod"), makeRepoId("foo", "bar")];
      expect(addRepoId(makeRepoId("foo", "bar"), registry)).toEqual(registry);
    });
    it("adding already-existing repoId shifts it to the end", () => {
      const registry = [makeRepoId("zoo", "zod"), makeRepoId("foo", "bar")];
      expect(addRepoId(makeRepoId("zoo", "zod"), registry)).toEqual([
        makeRepoId("foo", "bar"),
        makeRepoId("zoo", "zod"),
      ]);
    });
  });
  it("empty registry is empty", () => {
    expect(emptyRegistry()).toEqual([]);
  });
});
