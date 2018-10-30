// @flow

import {NodeAddress, EdgeAddress, Graph} from "../../core/graph";
import {FactorioStaticAdapter} from "./demoAdapters";
import {StaticAdapterSet} from "./adapterSet";
import {
  FallbackStaticAdapter,
  FALLBACK_NAME,
  fallbackNodeType,
  fallbackEdgeType,
} from "./fallbackAdapter";
import {Assets} from "../assets";
import {makeRepoId} from "../../core/repoId";

describe("app/adapters/adapterSet", () => {
  describe("StaticAdapterSet", () => {
    function example() {
      const x = new FactorioStaticAdapter();
      const fallback = new FallbackStaticAdapter();
      const sas = new StaticAdapterSet([x]);
      return {x, fallback, sas};
    }
    it("errors if two plugins have the same name", () => {
      const x = new FactorioStaticAdapter();
      const shouldError = () => new StaticAdapterSet([x, x]);
      expect(shouldError).toThrowError("Multiple plugins with name");
    });
    it("always includes the fallback plugin", () => {
      const {sas} = example();
      expect(sas.adapters()[0].declaration().name).toBe(FALLBACK_NAME);
    });
    it("includes the manually provided plugin adapters", () => {
      const {x, sas} = example();
      expect(sas.adapters()[1].declaration().name).toBe(x.declaration().name);
    });
    it("aggregates NodeTypes across plugins", () => {
      const {sas} = example();
      const nodeTypes = sas.nodeTypes();
      const expectedNumNodeTypes =
        new FactorioStaticAdapter().declaration().nodeTypes.length +
        new FallbackStaticAdapter().declaration().nodeTypes.length;
      expect(nodeTypes).toHaveLength(expectedNumNodeTypes);
    });
    it("aggregates EdgeTypes across plugins", () => {
      const {sas} = example();
      const edgeTypes = sas.edgeTypes();
      const expectedNumEdgeTypes =
        new FactorioStaticAdapter().declaration().edgeTypes.length +
        new FallbackStaticAdapter().declaration().edgeTypes.length;
      expect(edgeTypes).toHaveLength(expectedNumEdgeTypes);
    });
    it("finds adapter matching a node", () => {
      const {x, sas} = example();
      const matching = sas.adapterMatchingNode(
        NodeAddress.fromParts(["factorio", "inserter"])
      );
      expect(matching.declaration().name).toBe(x.declaration().name);
    });
    it("finds adapter matching an edge", () => {
      const {x, sas} = example();
      const matching = sas.adapterMatchingEdge(
        EdgeAddress.fromParts(["factorio", "assembles"])
      );
      expect(matching.declaration().name).toBe(x.declaration().name);
    });
    it("finds fallback adapter for unregistered node", () => {
      const {sas} = example();
      const adapter = sas.adapterMatchingNode(NodeAddress.fromParts(["weird"]));
      expect(adapter.declaration().name).toBe(FALLBACK_NAME);
    });
    it("finds fallback adapter for unregistered edge", () => {
      const {sas} = example();
      const adapter = sas.adapterMatchingEdge(EdgeAddress.fromParts(["weird"]));
      expect(adapter.declaration().name).toBe(FALLBACK_NAME);
    });
    it("finds type matching a node", () => {
      const {sas} = example();
      const type = sas.typeMatchingNode(
        NodeAddress.fromParts(["factorio", "inserter", "1", "foo"])
      );
      expect(type.name).toBe("inserter");
    });
    it("finds type matching an edge", () => {
      const {sas} = example();
      const type = sas.typeMatchingEdge(
        EdgeAddress.fromParts(["factorio", "assembles", "other", "1", "foo"])
      );
      expect(type.forwardName).toBe("assembles");
    });
    it("finds fallback type for unregistered node", () => {
      const {sas} = example();
      const type = sas.typeMatchingNode(
        NodeAddress.fromParts(["wombat", "1", "foo"])
      );
      expect(type).toBe(fallbackNodeType);
    });
    it("finds fallback type for unregistered edge", () => {
      const {sas} = example();
      const type = sas.typeMatchingEdge(
        EdgeAddress.fromParts(["wombat", "1", "foo"])
      );
      expect(type).toBe(fallbackEdgeType);
    });
    it("loads a dynamicAdapterSet", async () => {
      const {x, sas} = example();
      x.loadingMock = jest.fn();
      x.loadingMock.mockResolvedValue();
      expect(x.loadingMock).toHaveBeenCalledTimes(0);
      const assets = new Assets("/my/gateway/");
      const repoId = makeRepoId("foo", "bar");
      const das = await sas.load(assets, repoId);
      expect(x.loadingMock).toHaveBeenCalledTimes(1);
      expect(x.loadingMock.mock.calls[0]).toHaveLength(2);
      expect(x.loadingMock.mock.calls[0][0]).toBe(assets);
      expect(x.loadingMock.mock.calls[0][1]).toBe(repoId);
      expect(das).toEqual(expect.anything());
    });
  });

  describe("DynamicAdapterSet", () => {
    async function example() {
      const x = new FactorioStaticAdapter();
      const sas = new StaticAdapterSet([x]);
      const das = await sas.load(
        new Assets("/my/gateway/"),
        makeRepoId("foo", "bar")
      );
      return {x, sas, das};
    }
    it("allows retrieval of the original StaticAdapterSet", async () => {
      const {sas, das} = await example();
      expect(das.static()).toBe(sas);
    });
    it("allows accessing the dynamic adapters", async () => {
      const {sas, das} = await example();
      expect(das.adapters().map((a) => a.static().declaration().name)).toEqual(
        sas.adapters().map((a) => a.declaration().name)
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
        NodeAddress.fromParts(["factorio", "inserter"])
      );
      expect(matching.static().declaration().name).toBe(x.declaration().name);
    });
    it("finds adapter matching an edge", async () => {
      const {x, das} = await example();
      const matching = das.adapterMatchingEdge(
        EdgeAddress.fromParts(["factorio", "assembles"])
      );
      expect(matching.static().declaration().name).toBe(x.declaration().name);
    });
    it("finds fallback adapter for unregistered node", async () => {
      const {das} = await example();
      const adapter = das.adapterMatchingNode(NodeAddress.fromParts(["weird"]));
      expect(adapter.static().declaration().name).toBe(FALLBACK_NAME);
    });
    it("finds fallback adapter for unregistered edge", async () => {
      const {das} = await example();
      const adapter = das.adapterMatchingEdge(EdgeAddress.fromParts(["weird"]));
      expect(adapter.static().declaration().name).toBe(FALLBACK_NAME);
    });
  });
});
