// @flow

import {
  toJSON,
  fromJSON,
  addRepoId,
  emptyRegistry,
  type RepoIdRegistry,
} from "./repoIdRegistry";

import {makeRepoId} from "../core/repoId";

describe("core/repoIdRegistry", () => {
  describe("fromJSON compose on", () => {
    function checkExample(x: RepoIdRegistry) {
      expect(fromJSON(toJSON(x))).toEqual(x);
      expect(toJSON(fromJSON(toJSON(x)))).toEqual(toJSON(x));
    }
    it("empty registry", () => {
      checkExample(emptyRegistry());
    });
    it("nonempty registry", () => {
      checkExample([
        {repoId: makeRepoId("foo", "bar")},
        {repoId: makeRepoId("zoo", "zod")},
      ]);
    });
  });
  describe("addRepoId", () => {
    it("adds to empty registry", () => {
      expect(
        addRepoId(emptyRegistry(), {repoId: makeRepoId("foo", "bar")})
      ).toEqual([{repoId: makeRepoId("foo", "bar")}]);
    });
    it("adds to nonempty registry", () => {
      const registry = [{repoId: makeRepoId("foo", "bar")}];
      expect(addRepoId(registry, {repoId: makeRepoId("zoo", "zod")})).toEqual([
        {repoId: makeRepoId("foo", "bar")},
        {repoId: makeRepoId("zoo", "zod")},
      ]);
    });
    it("adding repoId that is already the last has no effect", () => {
      const registry = [
        {repoId: makeRepoId("zoo", "zod")},
        {repoId: makeRepoId("foo", "bar")},
      ];
      expect(addRepoId(registry, {repoId: makeRepoId("foo", "bar")})).toEqual(
        registry
      );
    });
    it("adding already-existing repoId shifts it to the end", () => {
      const registry = [
        {repoId: makeRepoId("zoo", "zod")},
        {repoId: makeRepoId("foo", "bar")},
      ];
      expect(addRepoId(registry, {repoId: makeRepoId("zoo", "zod")})).toEqual([
        {repoId: makeRepoId("foo", "bar")},
        {repoId: makeRepoId("zoo", "zod")},
      ]);
    });
  });
  it("empty registry is empty", () => {
    expect(emptyRegistry()).toEqual([]);
  });
});
