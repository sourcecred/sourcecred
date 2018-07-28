// @flow

import {
  toJSON,
  fromJSON,
  addRepo,
  emptyRegistry,
  type RepoRegistry,
} from "./repoRegistry";

import {makeRepo} from "../../core/repo";

describe("app/credExplorer/repoRegistry", () => {
  describe("to/fromJSON compose on", () => {
    function checkExample(x: RepoRegistry) {
      expect(fromJSON(toJSON(x))).toEqual(x);
      expect(toJSON(fromJSON(toJSON(x)))).toEqual(toJSON(x));
    }
    it("empty registry", () => {
      checkExample(emptyRegistry());
    });
    it("nonempty registry", () => {
      checkExample([makeRepo("foo", "bar"), makeRepo("zoo", "zod")]);
    });
  });
  describe("addRepo", () => {
    it("adds to empty registry", () => {
      expect(addRepo(makeRepo("foo", "bar"), emptyRegistry())).toEqual([
        makeRepo("foo", "bar"),
      ]);
    });
    it("adds to nonempty registry", () => {
      const registry = [makeRepo("foo", "bar")];
      expect(addRepo(makeRepo("zoo", "zod"), registry)).toEqual([
        makeRepo("foo", "bar"),
        makeRepo("zoo", "zod"),
      ]);
    });
    it("adding repo that is already the last has no effect", () => {
      const registry = [makeRepo("zoo", "zod"), makeRepo("foo", "bar")];
      expect(addRepo(makeRepo("foo", "bar"), registry)).toEqual(registry);
    });
    it("adding already-existing repo shifts it to the end", () => {
      const registry = [makeRepo("zoo", "zod"), makeRepo("foo", "bar")];
      expect(addRepo(makeRepo("zoo", "zod"), registry)).toEqual([
        makeRepo("foo", "bar"),
        makeRepo("zoo", "zod"),
      ]);
    });
  });
  it("empty registry is empty", () => {
    expect(emptyRegistry()).toEqual([]);
  });
});
