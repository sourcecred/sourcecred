// @flow

import {
  toJSON,
  fromJSON,
  addEntry,
  getEntry,
  emptyRegistry,
  type RepoIdRegistry,
  getRegistry,
  writeRegistry,
  REPO_ID_REGISTRY_FILE,
} from "./repoIdRegistry";

import {makeRepoId} from "../core/repoId";
import tmp from "tmp";
import path from "path";
import fs from "fs";

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

  describe("addEntry", () => {
    it("adds to empty registry", () => {
      expect(
        addEntry(emptyRegistry(), {repoId: makeRepoId("foo", "bar")})
      ).toEqual([{repoId: makeRepoId("foo", "bar")}]);
    });
    it("adds to nonempty registry", () => {
      const registry = [{repoId: makeRepoId("foo", "bar")}];
      expect(addEntry(registry, {repoId: makeRepoId("zoo", "zod")})).toEqual([
        {repoId: makeRepoId("foo", "bar")},
        {repoId: makeRepoId("zoo", "zod")},
      ]);
    });
    it("adding repoId that is already the last has no effect", () => {
      const registry = [
        {repoId: makeRepoId("zoo", "zod")},
        {repoId: makeRepoId("foo", "bar")},
      ];
      expect(addEntry(registry, {repoId: makeRepoId("foo", "bar")})).toEqual(
        registry
      );
    });
    it("adding already-existing repoId shifts it to the end", () => {
      const registry = [
        {repoId: makeRepoId("zoo", "zod")},
        {repoId: makeRepoId("foo", "bar")},
      ];
      expect(addEntry(registry, {repoId: makeRepoId("zoo", "zod")})).toEqual([
        {repoId: makeRepoId("foo", "bar")},
        {repoId: makeRepoId("zoo", "zod")},
      ]);
    });
  });

  describe("getEntry", () => {
    it("returns the matching entry by RepoId", () => {
      const entry = {repoId: makeRepoId("zoo", "zod")};
      const registry = addEntry(emptyRegistry(), entry);
      expect(getEntry(registry, entry.repoId)).toBe(entry);
    });
    it("returns undefined if there is no matching entry", () => {
      expect(getEntry(emptyRegistry(), makeRepoId("foo", "bar"))).toBe(
        undefined
      );
    });
  });

  it("empty registry is empty", () => {
    expect(emptyRegistry()).toEqual([]);
  });

  describe("{get,write}Registry", () => {
    const repoId = () => makeRepoId("foo", "bar");
    const entry = () => ({repoId: repoId()});
    const registry = () => addEntry(emptyRegistry(), entry());

    it("getRegistry returns empty registry if nothing present", () => {
      const dirname = tmp.dirSync().name;
      expect(getRegistry(dirname)).toEqual(emptyRegistry());
    });

    it("writeRegistry writes a repoIdRegistry to the directory", () => {
      const dirname = tmp.dirSync().name;
      const registryFile = path.join(dirname, REPO_ID_REGISTRY_FILE);

      expect(fs.existsSync(registryFile)).toBe(false);
      writeRegistry(registry(), dirname);
      expect(fs.existsSync(registryFile)).toBe(true);

      const contents = fs.readFileSync(registryFile);
      const registryJSON = JSON.parse(contents.toString());
      expect(toJSON(registry())).toEqual(registryJSON);
    });

    it("getRegistry returns the registry written by writeRegistry", () => {
      const dirname = tmp.dirSync().name;
      const repoId = makeRepoId("foo", "bar");
      const entry = {repoId};
      const registry = addEntry(emptyRegistry(), entry);
      writeRegistry(registry, dirname);
      expect(getRegistry(dirname)).toEqual(registry);
    });

    it("writeRegistry overwrites any existing registry", () => {
      const dirname = tmp.dirSync().name;
      const repoId = makeRepoId("foo", "bar");
      const entry = {repoId};
      const registry = addEntry(emptyRegistry(), entry);
      writeRegistry(registry, dirname);
      writeRegistry(emptyRegistry(), dirname);
      expect(getRegistry(dirname)).toEqual(emptyRegistry());
    });
  });
});
