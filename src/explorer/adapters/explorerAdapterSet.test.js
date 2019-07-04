// @flow

import {NodeAddress, EdgeAddress, Graph} from "../../core/graph";
import {FactorioStaticAdapter} from "../../plugins/demo/explorerAdapter";
import {StaticExplorerAdapterSet} from "./explorerAdapterSet";
import {Assets} from "../../webutil/assets";
import {makeRepoId} from "../../core/repoId";
import * as NullUtil from "../../util/null";

describe("explorer/adapters/explorerAdapterSet", () => {
  describe("StaticExplorerAdapterSet", () => {
    function example() {
      const x = new FactorioStaticAdapter();
      const sas = new StaticExplorerAdapterSet([x]);
      return {x, sas};
    }
    it("errors if two plugins have the same name", () => {
      const x = new FactorioStaticAdapter();
      const shouldError = () => new StaticExplorerAdapterSet([x, x]);
      expect(shouldError).toThrowError("Multiple plugins with name");
    });
    it("includes the manually provided plugin adapters", () => {
      const {x, sas} = example();
      expect(sas.adapters()[0].declaration().name).toBe(x.declaration().name);
    });
    it("aggregates NodeTypes across plugins", () => {
      const {sas} = example();
      const nodeTypes = sas.nodeTypes();
      const expectedNumNodeTypes = new FactorioStaticAdapter().declaration()
        .nodeTypes.length;
      expect(nodeTypes).toHaveLength(expectedNumNodeTypes);
    });
    it("aggregates EdgeTypes across plugins", () => {
      const {sas} = example();
      const edgeTypes = sas.edgeTypes();
      const expectedNumEdgeTypes = new FactorioStaticAdapter().declaration()
        .edgeTypes.length;
      expect(edgeTypes).toHaveLength(expectedNumEdgeTypes);
    });
    it("finds adapter matching a node", () => {
      const {x, sas} = example();
      let matching = sas.adapterMatchingNode(
        NodeAddress.fromParts(["factorio", "inserter"])
      );
      matching = NullUtil.get(matching);
      expect(matching.declaration().name).toBe(x.declaration().name);
    });
    it("finds adapter matching an edge", () => {
      const {x, sas} = example();
      let matching = sas.adapterMatchingEdge(
        EdgeAddress.fromParts(["factorio", "assembles"])
      );
      matching = NullUtil.get(matching);
      expect(matching.declaration().name).toBe(x.declaration().name);
    });
    it("finds no adapter for unregistered node", () => {
      const {sas} = example();
      const adapter = sas.adapterMatchingNode(NodeAddress.fromParts(["weird"]));
      expect(adapter).toBe(undefined);
    });
    it("finds no adapter for unregistered edge", () => {
      const {sas} = example();
      const adapter = sas.adapterMatchingEdge(EdgeAddress.fromParts(["weird"]));
      expect(adapter).toBe(undefined);
    });
    it("finds type matching a node", () => {
      const {sas} = example();
      const type = NullUtil.get(
        sas.typeMatchingNode(
          NodeAddress.fromParts(["factorio", "inserter", "1", "foo"])
        )
      );
      expect(type.name).toBe("inserter");
    });
    it("finds type matching an edge", () => {
      const {sas} = example();
      const type = NullUtil.get(
        sas.typeMatchingEdge(
          EdgeAddress.fromParts(["factorio", "assembles", "other", "1", "foo"])
        )
      );
      expect(type.forwardName).toBe("assembles");
    });
    it("finds no type for unregistered node", () => {
      const {sas} = example();
      const type = sas.typeMatchingNode(
        NodeAddress.fromParts(["wombat", "1", "foo"])
      );
      expect(type).toBe(undefined);
    });
    it("finds no type for unregistered edge", () => {
      const {sas} = example();
      const type = sas.typeMatchingEdge(
        EdgeAddress.fromParts(["wombat", "1", "foo"])
      );
      expect(type).toBe(undefined);
    });
    it("loads a dynamicExplorerAdapterSet", async () => {
      const {x, sas} = example();
      const loadingMock = jest.fn().mockResolvedValue();
      x.loadingMock = loadingMock;
      expect(x.loadingMock).toHaveBeenCalledTimes(0);
      const assets = new Assets("/my/gateway/");
      const repoId = makeRepoId("foo", "bar");
      const das = await sas.load(assets, repoId);
      expect(loadingMock).toHaveBeenCalledTimes(1);
      expect(loadingMock.mock.calls[0]).toHaveLength(2);
      expect(loadingMock.mock.calls[0][0]).toBe(assets);
      expect(loadingMock.mock.calls[0][1]).toBe(repoId);
      expect(das).toEqual(expect.anything());
    });
  });

  describe("DynamicExplorerAdapterSet", () => {
    async function example() {
      const x = new FactorioStaticAdapter();
      const sas = new StaticExplorerAdapterSet([x]);
      const das = await sas.load(
        new Assets("/my/gateway/"),
        makeRepoId("foo", "bar")
      );
      return {x, sas, das};
    }
    it("allows retrieval of the original StaticExplorerAdapterSet", async () => {
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
      let matching = das.adapterMatchingNode(
        NodeAddress.fromParts(["factorio", "inserter"])
      );
      matching = NullUtil.get(matching);
      expect(matching.static().declaration().name).toBe(x.declaration().name);
    });
    it("finds adapter matching an edge", async () => {
      const {x, das} = await example();
      let matching = das.adapterMatchingEdge(
        EdgeAddress.fromParts(["factorio", "assembles"])
      );
      matching = NullUtil.get(matching);
      expect(matching.static().declaration().name).toBe(x.declaration().name);
    });
    it("finds no adapter for unregistered node", async () => {
      const {das} = await example();
      const adapter = das.adapterMatchingNode(NodeAddress.fromParts(["weird"]));
      expect(adapter).toBe(undefined);
    });
    it("finds no adapter for unregistered edge", async () => {
      const {das} = await example();
      const adapter = das.adapterMatchingEdge(EdgeAddress.fromParts(["weird"]));
      expect(adapter).toBe(undefined);
    });
  });
});
