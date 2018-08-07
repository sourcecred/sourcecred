// @flow

import {
  Graph,
  NodeAddress,
  EdgeAddress,
  type NodeAddressT,
} from "../core/graph";
import {
  type StaticPluginAdapter,
  type DynamicPluginAdapter,
  staticDispatchByNode,
  staticDispatchByEdge,
  dynamicDispatchByNode,
  dynamicDispatchByEdge,
} from "./pluginAdapter";

describe("app/pluginAdapter", () => {
  function example() {
    const staticFooAdapter: StaticPluginAdapter = {
      name: () => "foo",
      nodePrefix: () => NodeAddress.fromParts(["foo"]),
      edgePrefix: () => EdgeAddress.fromParts(["foo"]),
      nodeTypes: () => [],
      edgeTypes: () => [],
      load: (_unused_repo) => Promise.resolve(dynamicFooAdapter),
    };
    const dynamicFooAdapter: DynamicPluginAdapter = {
      graph: () => new Graph(),
      nodeDescription: (x: NodeAddressT) => NodeAddress.toString(x),
      static: () => staticFooAdapter,
    };
    const staticBarAdapter: StaticPluginAdapter = {
      name: () => "bar",
      nodePrefix: () => NodeAddress.fromParts(["bar"]),
      edgePrefix: () => EdgeAddress.fromParts(["bar"]),
      nodeTypes: () => [],
      edgeTypes: () => [],
      load: (_unused_repo) => Promise.resolve(dynamicBarAdapter),
    };
    const dynamicBarAdapter: DynamicPluginAdapter = {
      graph: () => new Graph(),
      nodeDescription: (x) => NodeAddress.toString(x),
      static: () => staticBarAdapter,
    };
    const statics = [staticFooAdapter, staticBarAdapter];
    const dynamics = [dynamicFooAdapter, dynamicBarAdapter];
    return {
      statics,
      dynamics,
      staticFooAdapter,
      dynamicFooAdapter,
    };
  }

  describe("dispatching", () => {
    describe("error handling", () => {
      // Just testing staticDispatchByNode is fine, as they all call the same
      // implementation
      it("errors if it cannot match", () => {
        const {statics} = example();
        const zod = NodeAddress.fromParts(["zod"]);
        expect(() => staticDispatchByNode(statics, zod)).toThrowError(
          "No entity matches"
        );
      });
      it("errors if there are multiple matches", () => {
        const {staticFooAdapter} = example();
        const statics = [staticFooAdapter, staticFooAdapter];
        const foo = NodeAddress.fromParts(["foo"]);
        expect(() => staticDispatchByNode(statics, foo)).toThrowError(
          "Multiple entities match"
        );
      });
    });
    it("staticDispatchByNode works", () => {
      const {statics, staticFooAdapter} = example();
      const fooSubnode = NodeAddress.fromParts(["foo", "sub"]);
      expect(staticDispatchByNode(statics, fooSubnode)).toBe(staticFooAdapter);
    });
    it("staticDispatchByEdge works", () => {
      const {statics, staticFooAdapter} = example();
      const fooSubedge = EdgeAddress.fromParts(["foo", "sub"]);
      expect(staticDispatchByEdge(statics, fooSubedge)).toBe(staticFooAdapter);
    });
    it("dynamicDispatchByNode works", () => {
      const {dynamics, dynamicFooAdapter} = example();
      const fooSubnode = NodeAddress.fromParts(["foo", "sub"]);
      expect(dynamicDispatchByNode(dynamics, fooSubnode)).toBe(
        dynamicFooAdapter
      );
    });
    it("dynamicDispatchByEdge works", () => {
      const {dynamics, dynamicFooAdapter} = example();
      const fooSubedge = EdgeAddress.fromParts(["foo", "sub"]);
      expect(dynamicDispatchByEdge(dynamics, fooSubedge)).toBe(
        dynamicFooAdapter
      );
    });
  });
});
