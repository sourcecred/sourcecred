// @flow

import tmp from "tmp";
import path from "path";

import {Graph, NodeAddress, EdgeAddress} from "../core/graph";
import type {IAnalysisAdapter} from "../analysis/analysisAdapter";
import * as RepoIdRegistry from "../core/repoIdRegistry";
import {makeRepoId, type RepoId} from "../core/repoId";
import {loadGraph} from "./loadGraph";

class MockAnalysisAdapter implements IAnalysisAdapter {
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
    return {
      name: this._name,
      nodePrefix: NodeAddress.empty,
      edgePrefix: EdgeAddress.empty,
      nodeTypes: [],
      edgeTypes: [],
    };
  }

  async load(
    _unused_sourcecredDirectory: string,
    _unused_repoId: RepoId
  ): Promise<Graph> {
    if (this._resolutionGraph != null) {
      return this._resolutionGraph;
    } else {
      throw new Error("MockAnalysisAdapterRejects");
    }
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
        [new MockAnalysisAdapter("foo")],
        makeRepoId("foo", "bar")
      );
      expect(result).toEqual({status: "REPO_NOT_LOADED"});
    });
    it("returns status:REPO_NOT_LOADED when sourcecred directory doesn't exist", async () => {
      const dirname = path.join(tmp.dirSync().name, "nonexistent");
      const result = await loadGraph(
        dirname,
        [new MockAnalysisAdapter("foo")],
        makeRepoId("foo", "bar")
      );
      expect(result).toEqual({status: "REPO_NOT_LOADED"});
    });
    it("returns status:REPO_NOT_LOADED when the repo just isn't in the registry", async () => {
      const dirname = setUpRegistryWithId(makeRepoId("zod", "zoink"));
      const result = await loadGraph(
        dirname,
        [new MockAnalysisAdapter("foo")],
        makeRepoId("foo", "bar")
      );
      expect(result).toEqual({status: "REPO_NOT_LOADED"});
    });
    it("returns status:SUCCESS with merged graph on success", async () => {
      const g1 = new Graph().addNode(NodeAddress.fromParts(["g1"]));
      const g2 = new Graph().addNode(NodeAddress.fromParts(["g2"]));
      const m1 = new MockAnalysisAdapter("foo", g1);
      const m2 = new MockAnalysisAdapter("bar", g2);
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
      const mockAdapter = new MockAnalysisAdapter("bar");
      const repoId = makeRepoId("foo", "bar");
      const dir = setUpRegistryWithId(repoId);
      const result = await loadGraph(dir, [mockAdapter], repoId);
      expect(result).toEqual({
        status: "PLUGIN_FAILURE",
        pluginName: "bar",
        error: new Error("MockAnalysisAdapterRejects"),
      });
    });
  });
});
