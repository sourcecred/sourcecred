// @flow

import {run} from "./testUtil";
import {help, makeExportGraph} from "./exportGraph";
import {Graph, NodeAddress} from "../core/graph";
import stringify from "json-stable-stringify";

import {makeRepoId} from "../core/repoId";

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
    it("prints usage with '--help'", async () => {
      const exportGraph = makeExportGraph(jest.fn());
      expect(await run(exportGraph, ["--help"])).toEqual({
        exitCode: 0,
        stdout: expect.arrayContaining([
          expect.stringMatching(/^usage: sourcecred export-graph/),
        ]),
        stderr: [],
      });
    });

    it("errors if no repoId is provided", async () => {
      const exportGraph = makeExportGraph(jest.fn());
      expect(await run(exportGraph, [])).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: expect.arrayContaining([
          "fatal: no repository ID provided",
          "fatal: run 'sourcecred help export-graph' for help",
        ]),
      });
    });

    it("attempts to load the repoId provided", async () => {
      const mockFn = jest.fn();
      const exportGraph = makeExportGraph(mockFn);
      await run(exportGraph, ["foo/bar"]);
      expect(mockFn).toHaveBeenCalledWith(makeRepoId("foo", "bar"));
    });

    it("on load success, prints the stringified graph to stdout", async () => {
      const graph = new Graph().addNode(NodeAddress.empty);
      const loadGraphResult = {status: "SUCCESS", graph};
      const exportGraph = makeExportGraph(
        (_unused_repoId) => new Promise((resolve) => resolve(loadGraphResult))
      );
      const result = run(exportGraph, ["foo/bar"]);
      expect(await result).toEqual({
        exitCode: 0,
        stdout: [stringify(graph.toJSON())],
        stderr: [],
      });
    });

    it("errors if multiple repos are provided", async () => {
      const exportGraph = makeExportGraph(jest.fn());
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
      const loadGraphResult = {status: "REPO_NOT_LOADED"};
      const exportGraph = makeExportGraph(
        (_unused_repoId) => new Promise((resolve) => resolve(loadGraphResult))
      );
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

    it("reports the failing plugin when a plugin rejects", async () => {
      const loadGraphResult = {
        status: "PLUGIN_FAILURE",
        pluginName: "badPlugin",
        error: new Error("MockPluginFailure"),
      };
      const exportGraph = makeExportGraph(
        (_unused_repoId) => new Promise((resolve) => resolve(loadGraphResult))
      );
      const result = await run(exportGraph, ["foo/bar"]);
      expect(result).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: ['fatal: plugin "badPlugin" errored: MockPluginFailure'],
      });
    });
  });
});
