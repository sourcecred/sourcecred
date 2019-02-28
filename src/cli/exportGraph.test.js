// @flow

import tmp from "tmp";

import {run} from "./testUtil";
import {help, makeExportGraph} from "./exportGraph";
import {Graph, NodeAddress, EdgeAddress} from "../core/graph";
import type {IAnalysisAdapter} from "../analysis/analysisAdapter";
import stringify from "json-stable-stringify";

import * as RepoIdRegistry from "../core/repoIdRegistry";
import {makeRepoId, type RepoId} from "../core/repoId";

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

describe("cli/exportGraph", () => {
  describe("'help' command", () => {
    it("prints usage when given no arguments", async () => {
      expect(await run(help, [])).toEqual({
        exitCode: 0,
        stdout: expect.arrayContaining([
          expect.stringMatching(/^usage: sourcecred export-graph/),
        ]),
        stderr: [],
      });
    });
    it("fails when given arguments", async () => {
      expect(await run(help, ["foo/bar"])).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: expect.arrayContaining([
          expect.stringMatching(/^usage: sourcecred export-graph/),
        ]),
      });
    });
  });

  describe("'exportGraph' command", () => {
    function setUpRegistryWithId(repoId: RepoId) {
      const dirname = tmp.dirSync().name;
      process.env.SOURCECRED_DIRECTORY = dirname;
      const registry = RepoIdRegistry.addEntry(RepoIdRegistry.emptyRegistry(), {
        repoId,
      });
      RepoIdRegistry.writeRegistry(registry, dirname);
      return dirname;
    }

    it("prints usage with '--help'", async () => {
      const exportGraph = makeExportGraph([new MockAnalysisAdapter("foo")]);
      expect(await run(exportGraph, ["--help"])).toEqual({
        exitCode: 0,
        stdout: expect.arrayContaining([
          expect.stringMatching(/^usage: sourcecred export-graph/),
        ]),
        stderr: [],
      });
    });

    it("errors if no repoId is provided", async () => {
      const exportGraph = makeExportGraph([new MockAnalysisAdapter("foo")]);
      expect(await run(exportGraph, [])).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: expect.arrayContaining([
          "fatal: no repository ID provided",
          "fatal: run 'sourcecred help export-graph' for help",
        ]),
      });
    });

    it("throws an error if no plugins are available", async () => {
      const exportGraph = makeExportGraph([]);
      expect(await run(exportGraph, ["--help"])).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: [
          "fatal: no plugins available",
          "fatal: this is likely a build error",
        ],
      });
    });

    it("prints json-serialized graph to stdout for a single plugin", async () => {
      const g = new Graph().addNode(NodeAddress.empty);
      const mockAdapter = new MockAnalysisAdapter("foo", g);
      const exportGraph = makeExportGraph([mockAdapter]);
      setUpRegistryWithId(makeRepoId("foo", "bar"));
      const result = run(exportGraph, ["foo/bar"]);
      expect(await result).toEqual({
        exitCode: 0,
        stdout: [stringify(g.toJSON())],
        stderr: [],
      });
    });

    it("merges graphs for multiple plugins", async () => {
      const g1 = new Graph().addNode(NodeAddress.fromParts(["g1"]));
      const g2 = new Graph().addNode(NodeAddress.fromParts(["g2"]));
      const m1 = new MockAnalysisAdapter("foo", g1);
      const m2 = new MockAnalysisAdapter("bar", g2);
      const mergedGraph = Graph.merge([g1, g2]);
      setUpRegistryWithId(makeRepoId("foo", "bar"));
      const exportGraph = makeExportGraph([m1, m2]);
      expect(await run(exportGraph, ["foo/bar"])).toEqual({
        exitCode: 0,
        stdout: [stringify(mergedGraph.toJSON())],
        stderr: [],
      });
    });

    it("errors if multiple repos are provided", async () => {
      const m1 = new MockAnalysisAdapter("foo");
      const m2 = new MockAnalysisAdapter("bar");
      const exportGraph = makeExportGraph([m1, m2]);
      expect(await run(exportGraph, ["foo/bar", "zod/zoink"])).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: [
          "fatal: multiple repository IDs provided",
          "fatal: run 'sourcecred help export-graph' for help",
        ],
      });
    });

    it("errors if the repoId was not loaded first", async () => {
      const g = new Graph().addNode(NodeAddress.empty);
      const mockAdapter = new MockAnalysisAdapter("mock", g);
      const exportGraph = makeExportGraph([mockAdapter]);
      setUpRegistryWithId(makeRepoId("foo", "bar"));
      const result = run(exportGraph, ["zod/zoink"]);
      expect(await result).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: [
          "fatal: repository ID zod/zoink not loaded",
          "Try running `sourcecred load zod/zoink` first.",
        ],
      });
    });

    it("passes the right arguments to adapter.load", async () => {
      const mockAdapter = new MockAnalysisAdapter("zoo");
      const exportGraph = makeExportGraph([mockAdapter]);
      const repoId = makeRepoId("foo", "bar");
      // $ExpectFlowError
      mockAdapter.load = jest.fn();
      const directory = setUpRegistryWithId(repoId);
      await run(exportGraph, ["foo/bar"]);
      expect(mockAdapter.load).toHaveBeenCalledWith(directory, repoId);
    });

    it("reports the failing plugin when a plugin rejects", async () => {
      const mockAdapter = new MockAnalysisAdapter("bar");
      const exportGraph = makeExportGraph([mockAdapter]);
      const repoId = makeRepoId("foo", "bar");
      setUpRegistryWithId(repoId);
      const result = await run(exportGraph, ["foo/bar"]);
      expect(result).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: [
          'fatal: plugin "bar" errored: MockAnalysisAdapterRejects',
          "fatal: run 'sourcecred help export-graph' for help",
        ],
      });
    });
  });
});
