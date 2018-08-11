// @flow

import {
  NodeAddress,
  EdgeAddress,
  type NodeAddressT,
  Graph,
} from "../../core/graph";
import type {DynamicPluginAdapter} from "./pluginAdapter";
import {StaticAdapterSet} from "./adapterSet";
import {FallbackStaticAdapter, FALLBACK_NAME} from "./fallbackAdapter";
import {makeRepo, type Repo} from "../../core/repo";

describe("app/adapters/adapterSet", () => {
  class TestStaticPluginAdapter {
    loadingMock: Function;
    constructor() {
      this.loadingMock = jest.fn();
    }
    name() {
      return "other plugin";
    }
    nodePrefix() {
      return NodeAddress.fromParts(["other"]);
    }
    edgePrefix() {
      return EdgeAddress.fromParts(["other"]);
    }
    nodeTypes() {
      return [
        {
          name: "other1",
          defaultWeight: 0,
          prefix: NodeAddress.fromParts(["other", "1"]),
        },
        {
          name: "other2",
          defaultWeight: 0,
          prefix: NodeAddress.fromParts(["other", "2"]),
        },
      ];
    }
    edgeTypes() {
      return [
        {
          forwardName: "others_1",
          backwardName: "othered_by_1",
          prefix: EdgeAddress.fromParts(["other", "1"]),
        },
        {
          forwardName: "others_2",
          backwardName: "othered_by_2",
          prefix: EdgeAddress.fromParts(["other", "2"]),
        },
      ];
    }

    load(_unused_repo: Repo) {
      return this.loadingMock().then(() => new TestDynamicPluginAdapter());
    }
  }

  class TestDynamicPluginAdapter implements DynamicPluginAdapter {
    graph() {
      return new Graph().addNode(NodeAddress.fromParts(["other1", "example"]));
    }
    nodeDescription(x: NodeAddressT) {
      return `Node from the test plugin: ${NodeAddress.toString(x)}`;
    }
    static() {
      return new TestStaticPluginAdapter();
    }
  }

  describe("StaticAdapterSet", () => {
    function example() {
      const x = new TestStaticPluginAdapter();
      const fallback = new FallbackStaticAdapter();
      const sas = new StaticAdapterSet([x]);
      return {x, fallback, sas};
    }
    it("errors if two plugins have the same name", () => {
      const x = new TestStaticPluginAdapter();
      const shouldError = () => new StaticAdapterSet([x, x]);
      expect(shouldError).toThrowError("Multiple plugins with name");
    });
    it("always includes the fallback plugin", () => {
      const {sas} = example();
      expect(sas.adapters()[0].name()).toBe(FALLBACK_NAME);
    });
    it("includes the manually provided plugin adapters", () => {
      const {x, sas} = example();
      expect(sas.adapters()[1].name()).toBe(x.name());
    });
    it("aggregates NodeTypes across plugins", () => {
      const {sas} = example();
      const nodeTypes = sas.nodeTypes();
      expect(nodeTypes).toHaveLength(3);
    });
    it("aggregates EdgeTypes across plugins", () => {
      const {sas} = example();
      const edgeTypes = sas.edgeTypes();
      expect(edgeTypes).toHaveLength(3);
    });
    it("finds adapter matching a node", () => {
      const {x, sas} = example();
      const matching = sas.adapterMatchingNode(
        NodeAddress.fromParts(["other", "foo"])
      );
      expect(matching.name()).toBe(x.name());
    });
    it("finds adapter matching an edge", () => {
      const {x, sas} = example();
      const matching = sas.adapterMatchingEdge(
        EdgeAddress.fromParts(["other", "foo"])
      );
      expect(matching.name()).toBe(x.name());
    });
    it("finds fallback adapter for unregistered node", () => {
      const {sas} = example();
      const adapter = sas.adapterMatchingNode(NodeAddress.fromParts(["weird"]));
      expect(adapter.name()).toBe(FALLBACK_NAME);
    });
    it("finds fallback adapter for unregistered edge", () => {
      const {sas} = example();
      const adapter = sas.adapterMatchingEdge(EdgeAddress.fromParts(["weird"]));
      expect(adapter.name()).toBe(FALLBACK_NAME);
    });
    it("finds type matching a node", () => {
      const {sas} = example();
      const type = sas.typeMatchingNode(
        NodeAddress.fromParts(["other", "1", "foo"])
      );
      expect(type.name).toBe("other1");
    });
    it("finds type matching an edge", () => {
      const {sas} = example();
      const type = sas.typeMatchingEdge(
        EdgeAddress.fromParts(["other", "1", "foo"])
      );
      expect(type.forwardName).toBe("others_1");
    });
    it("finds fallback type for unregistered node", () => {
      const {sas} = example();
      const type = sas.typeMatchingNode(
        NodeAddress.fromParts(["wombat", "1", "foo"])
      );
      expect(type.name).toBe("(unknown node)");
    });
    it("finds fallback type for unregistered edge", () => {
      const {sas} = example();
      const type = sas.typeMatchingEdge(
        EdgeAddress.fromParts(["wombat", "1", "foo"])
      );
      expect(type.forwardName).toBe("(unknown edge→)");
    });
    it("loads a dynamicAdapterSet", async () => {
      const {x, sas} = example();
      x.loadingMock.mockResolvedValue();
      const das = await sas.load(makeRepo("foo", "bar"));
      expect(das).toEqual(expect.anything());
    });
  });

  describe("DynamicAdapterSet", () => {
    async function example() {
      const x = new TestStaticPluginAdapter();
      const sas = new StaticAdapterSet([x]);
      x.loadingMock.mockResolvedValue();
      const das = await sas.load(makeRepo("foo", "bar"));
      return {x, sas, das};
    }
    it("allows retrieval of the original StaticAdapterSet", async () => {
      const {sas, das} = await example();
      expect(das.static()).toBe(sas);
    });
    it("allows accessing the dynamic adapters", async () => {
      const {sas, das} = await example();
      expect(das.adapters().map((a) => a.static().name())).toEqual(
        sas.adapters().map((a) => a.name())
      );
    });
    it("allows retrieval of the aggregated graph", async () => {
      const {das} = await example();
      const expectedGraph = Graph.merge(das.adapters().map((x) => x.graph()));
      expect(das.graph().equals(expectedGraph)).toBe(true);
    });
    it("finds adapter matching a node", async () => {
      const {x, das} = await example();
      const matching = das.adapterMatchingNode(
        NodeAddress.fromParts(["other", "foo"])
      );
      expect(matching.static().name()).toBe(x.name());
    });
    it("finds adapter matching an edge", async () => {
      const {x, das} = await example();
      const matching = das.adapterMatchingEdge(
        EdgeAddress.fromParts(["other", "foo"])
      );
      expect(matching.static().name()).toBe(x.name());
    });
    it("finds fallback adapter for unregistered node", async () => {
      const {das} = await example();
      const adapter = das.adapterMatchingNode(NodeAddress.fromParts(["weird"]));
      expect(adapter.static().name()).toBe(FALLBACK_NAME);
    });
    it("finds fallback adapter for unregistered edge", async () => {
      const {das} = await example();
      const adapter = das.adapterMatchingEdge(EdgeAddress.fromParts(["weird"]));
      expect(adapter.static().name()).toBe(FALLBACK_NAME);
    });
  });
});
