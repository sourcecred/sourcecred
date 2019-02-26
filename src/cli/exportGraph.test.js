// @flow

import tmp from "tmp";

import {run} from "./testUtil";
import {help, makeExportGraph} from "./exportGraph";
import {Graph, NodeAddress, EdgeAddress} from "../core/graph";
import type {IAnalysisAdapter} from "../analysis/analysisAdapter";

import * as RepoIdRegistry from "../core/repoIdRegistry";
import {makeRepoId, type RepoId} from "../core/repoId";

const makeMockDeclaration = () => ({
  name: "mock",
  nodePrefix: NodeAddress.empty,
  edgePrefix: EdgeAddress.empty,
  nodeTypes: [],
  edgeTypes: [],
});

class MockAnalysisAdapter implements IAnalysisAdapter {
  _resolutionGraph: Graph | null;

  declaration() {
    return makeMockDeclaration();
  }

  load(
    _unused_sourcecredDirectory: string,
    _unused_repoId: RepoId
  ): Promise<Graph> {
    return new Promise((resolve, reject) => {
      if (this._resolutionGraph != null) {
        resolve(this._resolutionGraph);
      } else {
        reject("MockAnalysisAdapterRejects");
      }
    });
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
    function setupRegistryWithId(repoId: RepoId) {
      const dirname = tmp.dirSync().name;
      process.env.SOURCECRED_DIRECTORY = dirname;
      const registry = RepoIdRegistry.addEntry(RepoIdRegistry.emptyRegistry(), {
        repoId,
      });
      RepoIdRegistry.writeRegistry(registry, dirname);
      return dirname;
    }

    it("prints usage with '--help'", async () => {
      const exportGraph = makeExportGraph([new MockAnalysisAdapter()]);
      expect(await run(exportGraph, ["--help"])).toEqual({
        exitCode: 0,
        stdout: expect.arrayContaining([
          expect.stringMatching(/^usage: sourcecred export-graph/),
        ]),
        stderr: [],
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
      const mockAdapter = new MockAnalysisAdapter();
      const exportGraph = makeExportGraph([mockAdapter]);
      const g = new Graph().addNode(NodeAddress.empty);
      mockAdapter._resolutionGraph = g;
      setupRegistryWithId(makeRepoId("foo", "bar"));
      const result = run(exportGraph, ["foo/bar"]);
      expect(await result).toEqual({
        exitCode: 0,
        stdout: JSON.stringify(g.toJSON()).split("\n"),
        stderr: [],
      });
    });

    it("merges graphs for multiple plugins", async () => {
      const g1 = new Graph().addNode(NodeAddress.fromParts(["g1"]));
      const g2 = new Graph().addNode(NodeAddress.fromParts(["g2"]));
      const m1 = new MockAnalysisAdapter();
      m1._resolutionGraph = g1;
      const m2 = new MockAnalysisAdapter();
      m2._resolutionGraph = g2;
      const mergedGraph = Graph.merge([g1, g2]);
      setupRegistryWithId(makeRepoId("foo", "bar"));
      const exportGraph = makeExportGraph([m1, m2]);
      expect(await run(exportGraph, ["foo/bar"])).toEqual({
        exitCode: 0,
        stdout: JSON.stringify(mergedGraph.toJSON()).split("\n"),
        stderr: [],
      });
    });

    it("errors if multiple repos are provided", async () => {
      const m1 = new MockAnalysisAdapter();
      const m2 = new MockAnalysisAdapter();
      const exportGraph = makeExportGraph([m1, m2]);
      expect(await run(exportGraph, ["foo/bar", "zod/zoink"])).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: [
          "fatal: multiple repoIds provided",
          "fatal: run 'sourcecred help export-graph' for help",
        ],
      });
    });

    it("errors if the repoId was not loaded first", async () => {
      const mockAdapter = new MockAnalysisAdapter();
      const exportGraph = makeExportGraph([mockAdapter]);
      const g = new Graph().addNode(NodeAddress.empty);
      mockAdapter._resolutionGraph = g;
      setupRegistryWithId(makeRepoId("foo", "bar"));
      const result = run(exportGraph, ["zod/zoink"]);
      expect(await result).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: [
          "fatal: repoId zod/zoink not loaded",
          "try running `sourcecred load zod/zoink` first.",
        ],
      });
    });

    it("passes the right arguments to adapter.load", async () => {
      const mockAdapter = new MockAnalysisAdapter();
      const exportGraph = makeExportGraph([mockAdapter]);
      const repoId = makeRepoId("foo", "bar");
      // $ExpectFlowError
      mockAdapter.load = jest.fn();
      const directory = setupRegistryWithId(repoId);
      await run(exportGraph, ["foo/bar"]);
      expect(mockAdapter.load).toHaveBeenCalledWith(directory, repoId);
    });

    it("reports the failing plugin when a plugin rejects", async () => {
      const mockAdapter = new MockAnalysisAdapter();
      const exportGraph = makeExportGraph([mockAdapter]);
      const repoId = makeRepoId("foo", "bar");
      setupRegistryWithId(repoId);
      const result = await run(exportGraph, ["foo/bar"]);
      expect(result).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: [
          'fatal: plugin "mock" errored: MockAnalysisAdapterRejects',
          "fatal: run 'sourcecred help export-graph' for help",
        ],
      });
    });
  });
});
