// @flow

import deepFreeze from "deep-freeze";
import tmp from "tmp";
import path from "path";
import fs from "fs-extra";

import {validateToken} from "../plugins/github/token";
import type {Options as LoadGraphOptions} from "../plugins/github/loadGraph";
import type {Options as LoadDiscourseOptions} from "../plugins/discourse/loadDiscourse";
import {contractIdentities} from "../plugins/identity/contractIdentities";
import {type Project, createProject} from "../core/project";
import {
  directoryForProjectId,
  getProjectIds,
  loadProject,
} from "../core/project_io";
import {makeRepoId} from "../plugins/github/repoId";
import * as Weights from "../core/weights";
import {Graph} from "../core/graph";
import {node} from "../core/graphTestUtil";
import {TestTaskReporter} from "../util/taskReporter";
import {load, type LoadOptions} from "./load";
import {
  type TimelineCredParameters,
  partialParams,
} from "../analysis/timeline/params";
import * as WeightedGraph from "../core/weightedGraph";
import {DataDirectory} from "../backend/dataDirectory";
import {fromJSON as pluginsFromJSON} from "../analysis/pluginDeclaration";

type JestMockFn = $Call<typeof jest.fn>;
jest.mock("../plugins/github/loadWeightedGraph", () => ({
  loadWeightedGraph: jest.fn(),
}));
const githubWeightedGraph: JestMockFn = (require("../plugins/github/loadWeightedGraph")
  .loadWeightedGraph: any);
jest.mock("../plugins/discourse/loadWeightedGraph", () => ({
  loadWeightedGraph: jest.fn(),
}));
const discourseWeightedGraph: JestMockFn = (require("../plugins/discourse/loadWeightedGraph")
  .loadWeightedGraph: any);

jest.mock("../analysis/timeline/timelineCred", () => ({
  TimelineCred: {compute: jest.fn()},
}));
const timelineCredCompute: JestMockFn = (require("../analysis/timeline/timelineCred")
  .TimelineCred.compute: any);

describe("api/load", () => {
  const exampleGithubToken = validateToken("0".repeat(40));
  const fakeTimelineCred = deepFreeze({
    toJSON: () => ({is: "fake-timeline-cred"}),
  });
  const githubSentinel = node("github-sentinel");
  const githubGraph = () => {
    const graph = new Graph().addNode(githubSentinel);
    return {graph, weights: Weights.empty()};
  };
  const discourseSentinel = node("discourse-sentinel");
  const discourseGraph = () => {
    const graph = new Graph().addNode(discourseSentinel);
    return {graph, weights: Weights.empty()};
  };
  const combinedGraph = () =>
    WeightedGraph.merge([githubGraph(), discourseGraph()]);
  beforeEach(() => {
    jest.clearAllMocks();
    githubWeightedGraph.mockResolvedValue(githubGraph());
    discourseWeightedGraph.mockResolvedValue(discourseGraph());
    timelineCredCompute.mockResolvedValue(fakeTimelineCred);
  });
  const discourseServerUrl = "https://example.com";
  const project: Project = createProject({
    id: "foo",
    repoIds: [makeRepoId("foo", "bar")],
    discourseServer: {serverUrl: discourseServerUrl},
  });
  deepFreeze(project);
  const weightsOverrides = Weights.empty();
  const params: $Shape<TimelineCredParameters> = {};
  const plugins = deepFreeze([]);
  const example = () => {
    const sourcecredDirectory = tmp.dirSync().name;
    const taskReporter = new TestTaskReporter();
    const options: LoadOptions = {
      sourcecredDirectory,
      githubToken: exampleGithubToken,
      params,
      plugins,
      project,
      weightsOverrides,
    };
    return {options, taskReporter, sourcecredDirectory};
  };

  it("sets up a project directory for the project", async () => {
    const {options, taskReporter, sourcecredDirectory} = example();
    await load(options, taskReporter);
    expect(await getProjectIds(sourcecredDirectory)).toEqual([project.id]);
    expect(await loadProject(project.id, sourcecredDirectory)).toEqual(project);
  });

  it("calls github githubWeightedGraph with the right options", async () => {
    const {options, taskReporter, sourcecredDirectory} = example();
    await load(options, taskReporter);
    const cache = new DataDirectory(sourcecredDirectory);
    const expectedLoadGraphOptions: LoadGraphOptions = {
      repoIds: project.repoIds,
      token: exampleGithubToken,
      cache,
    };
    expect(githubWeightedGraph).toHaveBeenCalledWith(
      expectedLoadGraphOptions,
      taskReporter
    );
  });

  it("calls discourseWeightedGraph with the right options", async () => {
    const {options, taskReporter, sourcecredDirectory} = example();
    await load(options, taskReporter);
    const cacheDirectory = path.join(sourcecredDirectory, "cache");
    const expectedOptions: LoadDiscourseOptions = {
      discourseServer: {serverUrl: discourseServerUrl},
      cacheDirectory,
    };
    expect(discourseWeightedGraph).toHaveBeenCalledWith(
      expectedOptions,
      taskReporter
    );
  });

  it("saves a merged graph to disk", async () => {
    const {options, taskReporter, sourcecredDirectory} = example();
    await load(options, taskReporter);
    const projectDirectory = directoryForProjectId(
      project.id,
      sourcecredDirectory
    );
    const graphFile = path.join(projectDirectory, "weightedGraph.json");
    const graphJSON = JSON.parse(await fs.readFile(graphFile));
    const expectedJSON = WeightedGraph.toJSON(combinedGraph());
    expect(graphJSON).toEqual(expectedJSON);
  });

  it("calls TimelineCred.compute with the right graph and options", async () => {
    const {options, taskReporter} = example();
    await load(options, taskReporter);
    const args = timelineCredCompute.mock.calls[0][0];
    expect(args.weightedGraph.graph.equals(combinedGraph().graph)).toBe(true);
    expect(args.weightedGraph.weights).toEqual(combinedGraph().weights);
    expect(args.params).toEqual(partialParams(params));
    expect(args.plugins).toEqual(plugins);
  });

  it("saves the resultant cred.json to disk", async () => {
    const {options, taskReporter, sourcecredDirectory} = example();
    await load(options, taskReporter);
    const projectDirectory = directoryForProjectId(
      project.id,
      sourcecredDirectory
    );
    const credFile = path.join(projectDirectory, "cred.json");
    const credJSON = JSON.parse(await fs.readFile(credFile));
    expect(credJSON).toEqual(fakeTimelineCred.toJSON());
  });

  it("gives the right tasks to the TaskReporter", async () => {
    const {options, taskReporter} = example();
    await load(options, taskReporter);
    expect(taskReporter.activeTasks()).toEqual([]);
    expect(taskReporter.entries()).toEqual([
      {type: "START", taskId: "load-foo"},
      {type: "START", taskId: "load-weighted-graph"},
      {type: "FINISH", taskId: "load-weighted-graph"},
      {type: "START", taskId: "compute-cred"},
      {type: "FINISH", taskId: "compute-cred"},
      {type: "FINISH", taskId: "load-foo"},
    ]);
  });

  it("errors if GitHub repoIds are provided without a GitHub token", () => {
    const {options, taskReporter} = example();
    const optionsWithoutToken = {...options, githubToken: null};
    expect.assertions(1);
    return load(optionsWithoutToken, taskReporter).catch((e) =>
      expect(e.message).toMatch("no GitHub token")
    );
  });

  it("only loads GitHub if no Discourse server set", async () => {
    const {options, taskReporter, sourcecredDirectory} = example();
    const newProject = {...options.project, discourseServer: null};
    const newOptions = {...options, project: newProject};
    await load(newOptions, taskReporter);
    expect(discourseWeightedGraph).not.toHaveBeenCalled();
    const projectDirectory = directoryForProjectId(
      project.id,
      sourcecredDirectory
    );
    const graphFile = path.join(projectDirectory, "weightedGraph.json");
    const graphJSON = JSON.parse(await fs.readFile(graphFile));
    const expectedJSON = WeightedGraph.toJSON(githubGraph());
    expect(graphJSON).toEqual(expectedJSON);
  });

  it("only loads Discourse if no GitHub repoIds set ", async () => {
    const {options, taskReporter, sourcecredDirectory} = example();
    const newProject = {...options.project, repoIds: []};
    const newOptions = {...options, project: newProject, githubToken: null};
    await load(newOptions, taskReporter);
    expect(githubWeightedGraph).not.toHaveBeenCalled();
    const projectDirectory = directoryForProjectId(
      project.id,
      sourcecredDirectory
    );
    const graphFile = path.join(projectDirectory, "weightedGraph.json");
    const graphJSON = JSON.parse(await fs.readFile(graphFile));
    const expectedJSON = WeightedGraph.toJSON(discourseGraph());
    expect(graphJSON).toEqual(expectedJSON);
  });

  it("applies identity transformations, if present in the project", async () => {
    const {options, taskReporter, sourcecredDirectory} = example();
    const identity = {username: "identity", aliases: []};
    const newProject = {...options.project, identities: [identity]};
    const newOptions = {...options, project: newProject};
    await load(newOptions, taskReporter);
    const projectDirectory = directoryForProjectId(
      project.id,
      sourcecredDirectory
    );
    const graphFile = path.join(projectDirectory, "weightedGraph.json");
    const graphJSON = JSON.parse(await fs.readFile(graphFile));
    const identitySpec = {identities: [identity], discourseServerUrl};
    const identityGraph = contractIdentities(combinedGraph(), identitySpec);
    const expectedJSON = WeightedGraph.toJSON(identityGraph);
    expect(graphJSON).toEqual(expectedJSON);
  });

  it("saves plugin declarations to disk", async () => {
    const {options, taskReporter, sourcecredDirectory} = example();
    await load(options, taskReporter);
    const projectDirectory = directoryForProjectId(
      project.id,
      sourcecredDirectory
    );
    const pluginsFile = path.join(projectDirectory, "pluginDeclarations.json");
    const pluginsJSON = JSON.parse(await fs.readFile(pluginsFile));
    const actualPlugins = pluginsFromJSON(pluginsJSON);
    expect(actualPlugins).toEqual(plugins);
  });
});
