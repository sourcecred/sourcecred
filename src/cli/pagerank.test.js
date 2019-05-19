// @flow

import tmp from "tmp";
import path from "path";
import fs from "fs-extra";

import {run} from "./testUtil";
import {
  help,
  makePagerankCommand,
  savePagerankGraph,
  runPagerank,
  defaultPagerank,
  defaultSaver,
} from "./pagerank";
import {Graph, NodeAddress, EdgeAddress} from "../core/graph";
import {advancedGraph} from "../core/graphTestUtil";
import {
  PagerankGraph,
  DEFAULT_SYNTHETIC_LOOP_WEIGHT,
  DEFAULT_CONVERGENCE_THRESHOLD,
  DEFAULT_MAX_ITERATIONS,
} from "../core/pagerankGraph";
import {type NodeType, type EdgeType} from "../analysis/types";
import {defaultWeights} from "../analysis/weights";

import {weightsToEdgeEvaluator} from "../analysis/weightsToEdgeEvaluator";

import {makeRepoId, repoIdToString} from "../core/repoId";

describe("cli/pagerank", () => {
  describe("'help' command", () => {
    it("prints usage when given no arguments", async () => {
      expect(await run(help, [])).toEqual({
        exitCode: 0,
        stdout: expect.arrayContaining([
          expect.stringMatching(/^usage: sourcecred pagerank/),
        ]),
        stderr: [],
      });
    });
    it("fails when given arguments", async () => {
      expect(await run(help, ["foo/bar"])).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: expect.arrayContaining([
          expect.stringMatching(/^usage: sourcecred pagerank/),
        ]),
      });
    });
  });

  describe("'pagerank' command", () => {
    it("prints usage with '--help'", async () => {
      const pagerank = makePagerankCommand(jest.fn(), jest.fn(), jest.fn());
      expect(await run(pagerank, ["--help"])).toEqual({
        exitCode: 0,
        stdout: expect.arrayContaining([
          expect.stringMatching(/^usage: sourcecred pagerank/),
        ]),
        stderr: [],
      });
    });

    it("errors if no repoId is provided", async () => {
      const pagerank = makePagerankCommand(jest.fn(), jest.fn(), jest.fn());
      expect(await run(pagerank, [])).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: expect.arrayContaining([
          "fatal: no repository ID provided",
          "fatal: run 'sourcecred help pagerank' for help",
        ]),
      });
    });

    it("errors if multiple repos are provided", async () => {
      const pagerank = makePagerankCommand(jest.fn(), jest.fn(), jest.fn());
      expect(await run(pagerank, ["foo/bar", "zod/zoink"])).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: [
          "fatal: multiple repository IDs provided",
          "fatal: run 'sourcecred help pagerank' for help",
        ],
      });
    });

    it("errors if the repoId was not loaded first", async () => {
      const loadResult = {status: "REPO_NOT_LOADED"};
      const loader = () => new Promise((resolve) => resolve(loadResult));
      const pagerank = makePagerankCommand(loader, jest.fn(), jest.fn());
      const result = run(pagerank, ["zod/zoink"]);
      expect(await result).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: [
          "fatal: repository ID zod/zoink not loaded",
          "Try running `sourcecred load zod/zoink` first.",
        ],
      });
    });

    it("passes the right arguments to loadGraph", async () => {
      const mockLoader = jest.fn();
      const pagerank = makePagerankCommand(mockLoader, jest.fn(), jest.fn());
      const repoId = makeRepoId("foo", "bar");
      await run(pagerank, ["foo/bar"]);
      expect(mockLoader).toHaveBeenCalledWith(repoId);
    });

    it("prints a message if there was a plugin failure", async () => {
      const failure = {
        status: "PLUGIN_FAILURE",
        pluginName: "foo",
        error: new Error("FooError"),
      };
      const loader = (_unused_repoId) =>
        new Promise((resolve) => resolve(failure));
      const command = makePagerankCommand(loader, jest.fn(), jest.fn());
      const result = await run(command, ["foo/bar"]);
      expect(result).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: ['fatal: plugin "foo" errored: FooError'],
      });
    });

    describe("on successful load", () => {
      const graph = () => new Graph().addNode(NodeAddress.empty);
      const graphResult = () => ({status: "SUCCESS", graph: graph()});
      const loader = (_unused_repoId) =>
        new Promise((resolve) => resolve(graphResult()));
      const evaluator = (_unused_edge) => ({toWeight: 1, froWeight: 1});
      const pagerankGraph = () => new PagerankGraph(graph(), evaluator, 0.001);
      const mockPagerankRunner = (_unused_graph) =>
        new Promise((resolve) => resolve(pagerankGraph()));

      it("passes the loaded graph to the pagerank runner", async () => {
        const mock = jest.fn();
        const command = makePagerankCommand(loader, mock, jest.fn());
        await run(command, ["foo/bar"]);
        expect(mock).toHaveBeenCalledWith(graph());
      });

      it("passes the resultant pagerankGraph to the saver", async () => {
        const mock = jest.fn();
        const command = makePagerankCommand(loader, mockPagerankRunner, mock);
        await run(command, ["foo/bar"]);
        const repoId = makeRepoId("foo", "bar");
        expect(mock).toHaveBeenCalledWith(repoId, pagerankGraph());
      });

      it("returns with exit code 0 and nothing printed to stdout/stderr", async () => {
        const command = makePagerankCommand(
          loader,
          mockPagerankRunner,
          jest.fn()
        );
        const result = await run(command, ["foo/bar"]);
        expect(result).toEqual({
          exitCode: 0,
          stdout: [],
          stderr: [],
        });
      });
    });
  });

  describe("savePagerankGraph", () => {
    it("saves the PagerankGraphJSON to the right filepath", async () => {
      const graph = new Graph().addNode(NodeAddress.empty);
      const evaluator = (_unused_edge) => ({toWeight: 1, froWeight: 2});
      const prg = new PagerankGraph(graph, evaluator);
      const dirname = tmp.dirSync().name;
      const repoId = makeRepoId("foo", "bar");
      await savePagerankGraph(dirname, repoId, prg);
      const expectedPath = path.join(
        dirname,
        "data",
        repoIdToString(repoId),
        "pagerankGraph.json"
      );
      const blob = fs.readFileSync(expectedPath).toString();
      const json = JSON.parse(blob);
      expect(json).toEqual(prg.toJSON());
    });
  });

  describe("runPagerank", () => {
    it("computes pagerank with the given weights", async () => {
      const nodeType: NodeType = {
        name: "foo",
        pluralName: "foos",
        prefix: NodeAddress.fromParts(["src"]),
        defaultWeight: 3,
        description: "an example node type",
      };
      const edgeType: EdgeType = {
        forwardName: "bars",
        backwardName: "barred by",
        defaultWeight: {
          forwards: 5,
          backwards: 3,
        },
        prefix: EdgeAddress.fromParts(["hom"]),
        description: "an example edge type",
      };
      const types = {
        nodeTypes: [nodeType],
        edgeTypes: [edgeType],
      };

      const graph = advancedGraph().graph1();
      const actualPagerankGraph = await runPagerank(
        defaultWeights(),
        graph,
        types
      );
      const expectedPagerankGraph = new PagerankGraph(
        graph,
        weightsToEdgeEvaluator(defaultWeights(), types),
        DEFAULT_SYNTHETIC_LOOP_WEIGHT
      );
      await expectedPagerankGraph.runPagerank({
        convergenceThreshold: DEFAULT_CONVERGENCE_THRESHOLD,
        maxIterations: DEFAULT_MAX_ITERATIONS,
      });
      expect(actualPagerankGraph.equals(expectedPagerankGraph)).toBe(true);
    });
    it("default pageRank is robust to nodes that are not owned by any plugin", async () => {
      const graph = new Graph().addNode(NodeAddress.empty).addEdge({
        address: EdgeAddress.empty,
        src: NodeAddress.empty,
        dst: NodeAddress.empty,
      });
      await defaultPagerank(graph);
    });
  });
  it("defaultSaver saves to sourcecred directory", async () => {
    const dirname = tmp.dirSync().name;
    process.env.SOURCECRED_DIRECTORY = dirname;
    const repoId = makeRepoId("foo", "bar");
    const prg = new PagerankGraph(
      new Graph().addNode(NodeAddress.empty),
      (_unused_edge) => ({toWeight: 1, froWeight: 2})
    );
    await defaultSaver(repoId, prg);
    const expectedPath = path.join(
      dirname,
      "data",
      "foo/bar",
      "pagerankGraph.json"
    );
    const blob = await fs.readFile(expectedPath);
    const actualJSON = JSON.parse(blob.toString());
    expect(actualJSON).toEqual(prg.toJSON());
  });
});
