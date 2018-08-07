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
  findNodeType,
  findEdgeType,
} from "./pluginAdapter";

describe("app/pluginAdapter", () => {
  function example() {
    const staticFooAdapter: StaticPluginAdapter = {
      name: () => "foo",
      nodePrefix: () => NodeAddress.fromParts(["foo"]),
      edgePrefix: () => EdgeAddress.fromParts(["foo"]),
      nodeTypes: () => [
        {
          name: "zap",
          prefix: NodeAddress.fromParts(["foo", "zap"]),
          defaultWeight: 0,
        },
        {
          name: "kif",
          prefix: NodeAddress.fromParts(["foo", "kif"]),
          defaultWeight: 0,
        },
        {
          name: "bad-duplicate-1",
          prefix: NodeAddress.fromParts(["foo", "bad"]),
          defaultWeight: 0,
        },
        {
          name: "bad-duplicate-2",
          prefix: NodeAddress.fromParts(["foo", "bad"]),
          defaultWeight: 0,
        },
      ],
      edgeTypes: () => [
        {
          forwardName: "kifs",
          backwardName: "kiffed by",
          prefix: EdgeAddress.fromParts(["foo", "kif"]),
        },
        {
          forwardName: "zaps",
          backwardName: "zapped by",
          prefix: EdgeAddress.fromParts(["foo", "zap"]),
        },
        {
          forwardName: "bad1",
          backwardName: "bad1'd by",
          prefix: EdgeAddress.fromParts(["foo", "bad"]),
        },
        {
          forwardName: "bad2",
          backwardName: "bad2'd by",
          prefix: EdgeAddress.fromParts(["foo", "bad"]),
        },
      ],
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

  describe("findNodeType", () => {
    it("works in a simple case", () => {
      const {staticFooAdapter} = example();
      const kifNode = NodeAddress.fromParts(["foo", "kif", "node"]);
      expect(findNodeType(staticFooAdapter, kifNode).name).toEqual("kif");
    });
    it("errors if node doesn't match the plugin", () => {
      const {staticFooAdapter} = example();
      const wrongNode = NodeAddress.fromParts(["bar", "kif", "node"]);
      expect(() => findNodeType(staticFooAdapter, wrongNode)).toThrowError(
        "wrong plugin adapter"
      );
    });
    it("errors if there's no matching type", () => {
      const {staticFooAdapter} = example();
      const wrongNode = NodeAddress.fromParts(["foo", "leela", "node"]);
      expect(() => findNodeType(staticFooAdapter, wrongNode)).toThrowError(
        "No entity matches"
      );
    });
    it("errors if there's multiple matching types", () => {
      const {staticFooAdapter} = example();
      const wrongNode = NodeAddress.fromParts(["foo", "bad", "brannigan"]);
      expect(() => findNodeType(staticFooAdapter, wrongNode)).toThrowError(
        "Multiple entities match"
      );
    });
  });

  describe("findEdgeType", () => {
    it("works in a simple case", () => {
      const {staticFooAdapter} = example();
      const kifEdge = EdgeAddress.fromParts(["foo", "kif", "edge"]);
      expect(findEdgeType(staticFooAdapter, kifEdge).forwardName).toEqual(
        "kifs"
      );
    });
    it("errors if edge doesn't match the plugin", () => {
      const {staticFooAdapter} = example();
      const wrongEdge = EdgeAddress.fromParts(["bar", "kif", "edge"]);
      expect(() => findEdgeType(staticFooAdapter, wrongEdge)).toThrowError(
        "wrong plugin adapter"
      );
    });
    it("errors if there's no matching type", () => {
      const {staticFooAdapter} = example();
      const wrongEdge = EdgeAddress.fromParts(["foo", "leela", "edge"]);
      expect(() => findEdgeType(staticFooAdapter, wrongEdge)).toThrowError(
        "No entity matches"
      );
    });
    it("errors if there's multiple matching types", () => {
      const {staticFooAdapter} = example();
      const wrongEdge = EdgeAddress.fromParts(["foo", "bad", "brannigan"]);
      expect(() => findEdgeType(staticFooAdapter, wrongEdge)).toThrowError(
        "Multiple entities match"
      );
    });
  });
});
