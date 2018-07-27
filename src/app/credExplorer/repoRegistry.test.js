// @flow

import {
  toJSON,
  fromJSON,
  addRepo,
  emptyRegistry,
  type RepoRegistry,
} from "./repoRegistry";

describe("app/credExplorer/repoRegistry", () => {
  const r = (owner, name) => ({owner, name});
  describe("to/fromJSON compose on", () => {
    function checkExample(x: RepoRegistry) {
      expect(fromJSON(toJSON(x))).toEqual(x);
      expect(toJSON(fromJSON(toJSON(x)))).toEqual(toJSON(x));
    }
    it("empty registry", () => {
      checkExample(emptyRegistry());
    });
    it("nonempty registry", () => {
      checkExample([r("foo", "bar"), r("zoo", "zod")]);
    });
  });
  describe("addRepo", () => {
    it("adds to empty registry", () => {
      expect(addRepo(r("foo", "bar"), emptyRegistry())).toEqual([
        r("foo", "bar"),
      ]);
    });
    it("adds to nonempty registry", () => {
      const registry = [r("foo", "bar")];
      expect(addRepo(r("zoo", "zod"), registry)).toEqual([
        r("foo", "bar"),
        r("zoo", "zod"),
      ]);
    });
    it("adding repo that is already the last has no effect", () => {
      const registry = [r("zoo", "zod"), r("foo", "bar")];
      expect(addRepo(r("foo", "bar"), registry)).toEqual(registry);
    });
    it("adding already-existing repo shifts it to the end", () => {
      const registry = [r("zoo", "zod"), r("foo", "bar")];
      expect(addRepo(r("zoo", "zod"), registry)).toEqual([
        r("foo", "bar"),
        r("zoo", "zod"),
      ]);
    });
  });
  it("empty registry is empty", () => {
    expect(emptyRegistry()).toEqual([]);
  });
});
