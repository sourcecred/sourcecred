// @flow

import tmp from "tmp";
import {
  Graph,
  type NodeAddressT,
  NodeAddress,
  EdgeAddress,
} from "../core/graph";
import {makeRepoId} from "../core/repoId";
import {
  createDescriptionMap,
  readDescriptionMap,
  writeDescriptionMap,
} from "./descriptionMap";

describe("src/analysis/descriptionMap", () => {
  const foo = NodeAddress.fromParts(["foo"]);
  const bar = NodeAddress.fromParts(["bar"]);

  describe("createDescriptionMap", () => {
    const declarationForPrefix = (prefixParts: string[]) => ({
      name: NodeAddress.fromParts(prefixParts),
      nodePrefix: NodeAddress.fromParts(prefixParts),
      edgePrefix: EdgeAddress.fromParts(prefixParts),
      nodeTypes: [],
      edgeTypes: [],
    });
    const adapterForPrefix = (
      prefixParts: string[],
      description: (NodeAddressT) => string | null
    ) => {
      class Adapter {
        declaration() {
          return declarationForPrefix(prefixParts);
        }
        graph() {
          return new Graph();
        }
        createdAt(_unused_node: NodeAddressT) {
          return null;
        }
        description(n: NodeAddressT): string | null {
          return description(n);
        }
      }
      return new Adapter();
    };
    it("matches the most specific adapter", () => {
      const fooAdapter = adapterForPrefix(["foo"], (_) => "foo");
      const fallbackAdapter = adapterForPrefix([], (_) => null);
      const nodes = [foo, bar];
      const tsMap = createDescriptionMap(nodes, [fooAdapter, fallbackAdapter]);
      // foo got its description from the fooAdapter, not from the fallbackAdapter,
      // even though it matched both.
      expect(tsMap.get(foo)).toEqual("foo");
      // Bar matched the fallback adapter.
      expect(tsMap.get(bar)).toEqual(null);
    });
    it("throws an error if there is no matching adapter", () => {
      const foo = NodeAddress.fromParts(["foo"]);
      expect(() => createDescriptionMap([foo], [])).toThrowError(
        `No adapter for NodeAddress["foo"]`
      );
    });
  });
  describe("{write,read}DescriptionMap", () => {
    const repo = makeRepoId("foo", "bar");
    it("throws an error if there is no description map to read", () => {
      const dir = tmp.dirSync().name;
      expect(() => readDescriptionMap(dir, repo)).toThrowError(
        "ENOENT: no such file or directory"
      );
    });
    it("can write/read the empty registry", () => {
      const dir = tmp.dirSync().name;
      const map = new Map();
      writeDescriptionMap(map, dir, repo);
      const map2 = readDescriptionMap(dir, repo);
      expect(map2).toEqual(map);
    });
    it("can write/read a non-empty registry", () => {
      const dir = tmp.dirSync().name;
      const map = new Map([[foo, null], [bar, "foo"]]);
      writeDescriptionMap(map, dir, repo);
      const map2 = readDescriptionMap(dir, repo);
      expect(map2).toEqual(map);
    });
  });
});
