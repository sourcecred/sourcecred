// @flow

import tmp from "tmp";
import path from "path";

import {
  Graph,
  type NodeAddressT,
  NodeAddress,
  EdgeAddress,
} from "../core/graph";
import type {
  IBackendAdapterLoader,
  IAnalysisAdapter,
} from "../analysis/analysisAdapter";
import * as RepoIdRegistry from "../core/repoIdRegistry";
import {makeRepoId, type RepoId} from "../core/repoId";
import {loadGraph} from "./loadGraph";

const declaration = (name) => ({
  name,
  nodePrefix: NodeAddress.empty,
  edgePrefix: EdgeAddress.empty,
  nodeTypes: Object.freeze([]),
  edgeTypes: Object.freeze([]),
});

class MockStaticAdapter implements IBackendAdapterLoader {
  _resolutionGraph: ?Graph;
  _name: string;

  /**
   * Takes a name for the plugin, and a graph that
   * is provided as a result of a successful load.
   * If no graph is provided, then load will fail.
   */
  constructor(name: string, resolutionGraph: ?Graph) {
    this._name = name;
    this._resolutionGraph = resolutionGraph;
  }

  declaration() {
    return declaration(this._name);
  }

  async load(
    _unused_sourcecredDirectory: string,
    _unused_repoId: RepoId
  ): Promise<MockAdapter> {
    if (this._resolutionGraph != null) {
      return new MockAdapter(this._name, this._resolutionGraph);
    } else {
      throw new Error("MockStaticAdapterRejects");
    }
  }
}

class MockAdapter implements IAnalysisAdapter {
  _name: string;
  _resolutionGraph: Graph;
  constructor(name: string, resolutionGraph: Graph) {
    this._name = name;
    this._resolutionGraph = resolutionGraph;
  }
  repoId() {
    return makeRepoId("foo", "bar");
  }
  createdAt(_unused_node: NodeAddressT): number | null {
    return null;
  }
  declaration() {
    return declaration(this._name);
  }
  graph() {
    return this._resolutionGraph;
  }
  description(_unused_node): string | null {
    return null;
  }
}

describe("analysis/loadGraph", () => {
  function setUpRegistryWithId(repoId: RepoId) {
    const dirname = tmp.dirSync().name;
    process.env.SOURCECRED_DIRECTORY = dirname;
    const registry = RepoIdRegistry.addEntry(RepoIdRegistry.emptyRegistry(), {
      repoId,
    });
    RepoIdRegistry.writeRegistry(registry, dirname);
    return dirname;
  }
  describe("loadGraph", () => {
    it("returns status:REPO_NOT_LOADED when sourcecred directory is empty", async () => {
      const dirname = tmp.dirSync().name;
      const result = await loadGraph(
        dirname,
        [new MockStaticAdapter("foo")],
        makeRepoId("foo", "bar")
      );
      expect(result).toEqual({status: "REPO_NOT_LOADED"});
    });
    it("returns status:REPO_NOT_LOADED when sourcecred directory doesn't exist", async () => {
      const dirname = path.join(tmp.dirSync().name, "nonexistent");
      const result = await loadGraph(
        dirname,
        [new MockStaticAdapter("foo")],
        makeRepoId("foo", "bar")
      );
      expect(result).toEqual({status: "REPO_NOT_LOADED"});
    });
    it("returns status:REPO_NOT_LOADED when the repo just isn't in the registry", async () => {
      const dirname = setUpRegistryWithId(makeRepoId("zod", "zoink"));
      const result = await loadGraph(
        dirname,
        [new MockStaticAdapter("foo")],
        makeRepoId("foo", "bar")
      );
      expect(result).toEqual({status: "REPO_NOT_LOADED"});
    });
    it("returns status:SUCCESS with merged graph on success", async () => {
      const g1 = new Graph().addNode(NodeAddress.fromParts(["g1"]));
      const g2 = new Graph().addNode(NodeAddress.fromParts(["g2"]));
      const m1 = new MockStaticAdapter("foo", g1);
      const m2 = new MockStaticAdapter("bar", g2);
      const mergedGraph = Graph.merge([g1, g2]);
      const dir = setUpRegistryWithId(makeRepoId("foo", "bar"));
      const result = await loadGraph(dir, [m1, m2], makeRepoId("foo", "bar"));
      expect(result.status).toEqual("SUCCESS");
      if (result.status !== "SUCCESS") {
        throw new Error("Unreachable, needed to satisfy flow.");
      }
      expect(mergedGraph.equals(result.graph)).toBe(true);
    });
    it("returns an empty graph if no adapters provided", async () => {
      const dir = setUpRegistryWithId(makeRepoId("foo", "bar"));
      const result = await loadGraph(dir, [], makeRepoId("foo", "bar"));
      expect(result.status).toEqual("SUCCESS");
      if (result.status !== "SUCCESS") {
        throw new Error("Unreachable, needed to satisfy flow.");
      }
      expect(result.graph.equals(new Graph())).toBe(true);
    });
    it("returns a status:PLUGIN_FAILURE if the plugin errors", async () => {
      const mockAdapter = new MockStaticAdapter("bar");
      const repoId = makeRepoId("foo", "bar");
      const dir = setUpRegistryWithId(repoId);
      const result = await loadGraph(dir, [mockAdapter], repoId);
      expect(result).toEqual({
        status: "PLUGIN_FAILURE",
        pluginName: "bar",
        error: new Error("MockStaticAdapterRejects"),
      });
    });
  });
});
