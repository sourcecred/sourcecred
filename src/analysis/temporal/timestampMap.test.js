// @flow

import tmp from "tmp";
import {
  Graph,
  type NodeAddressT,
  NodeAddress,
  EdgeAddress,
} from "../../core/graph";
import {makeRepoId} from "../../core/repoId";
import {
  createTimestampMap,
  readTimestampMap,
  writeTimestampMap,
} from "./timestampMap";

describe("src/analysis/temporal/timestampMap", () => {
  const foo = NodeAddress.fromParts(["foo"]);
  const bar = NodeAddress.fromParts(["bar"]);

  describe("createTimestampMap", () => {
    const declarationForPrefix = (prefixParts: string[]) => ({
      name: NodeAddress.fromParts(prefixParts),
      nodePrefix: NodeAddress.fromParts(prefixParts),
      edgePrefix: EdgeAddress.fromParts(prefixParts),
      nodeTypes: [],
      edgeTypes: [],
    });
    const adapterForPrefix = (
      prefixParts: string[],
      createdAt: (NodeAddressT) => number | null
    ) => {
      class Adapter {
        declaration() {
          return declarationForPrefix(prefixParts);
        }
        graph() {
          return new Graph();
        }
        createdAt(n: NodeAddressT) {
          return createdAt(n);
        }
      }
      return new Adapter();
    };
    it("matches the most specific adapter", () => {
      const fooAdapter = adapterForPrefix(["foo"], (_) => 1);
      const fallbackAdapter = adapterForPrefix([], (_) => null);
      const nodes = [foo, bar];
      const tsMap = createTimestampMap(nodes, [fooAdapter, fallbackAdapter]);
      // foo got its timestamp from the fooAdapter, not from the fallbackAdapter,
      // even though it matched both.
      expect(tsMap.get(foo)).toEqual(1);
      // Bar matched the fallback adapter.
      expect(tsMap.get(bar)).toEqual(null);
    });
    it("throws an error if there is no matching adapter", () => {
      const foo = NodeAddress.fromParts(["foo"]);
      expect(() => createTimestampMap([foo], [])).toThrowError(
        `No adapter for NodeAddress["foo"]`
      );
    });
  });
  describe("{write,read}TimestampMap", () => {
    const repo = makeRepoId("foo", "bar");
    it("throws an error if there is no timestamp map to read", () => {
      const dir = tmp.dirSync().name;
      expect(() => readTimestampMap(dir, repo)).toThrowError(
        "ENOENT: no such file or directory"
      );
    });
    it("can write/read the empty registry", () => {
      const dir = tmp.dirSync().name;
      const map = new Map();
      writeTimestampMap(map, dir, repo);
      const map2 = readTimestampMap(dir, repo);
      expect(map2).toEqual(map);
    });
    it("can write/read a non-empty registry", () => {
      const dir = tmp.dirSync().name;
      const map = new Map([[foo, null], [bar, 3]]);
      writeTimestampMap(map, dir, repo);
      const map2 = readTimestampMap(dir, repo);
      expect(map2).toEqual(map);
    });
  });
});
