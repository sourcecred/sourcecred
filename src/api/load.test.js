// @flow

import deepFreeze from "deep-freeze";
import tmp from "tmp";
import path from "path";
import fs from "fs-extra";

import type {Options as LoadGraphOptions} from "../plugins/github/loadGraph";
import type {Options as LoadDiscourseOptions} from "../plugins/discourse/loadDiscourse";
import type {Project} from "../core/project";
import {
  directoryForProjectId,
  getProjectIds,
  loadProject,
} from "../core/project_io";
import {makeRepoId} from "../core/repoId";
import {defaultWeights} from "../analysis/weights";
import {NodeAddress, Graph} from "../core/graph";
import {node} from "../core/graphTestUtil";
import {TestTaskReporter} from "../util/taskReporter";
import {load, type LoadOptions} from "./load";
import {DEFAULT_CRED_CONFIG} from "../plugins/defaultCredConfig";

type JestMockFn = $Call<typeof jest.fn>;
jest.mock("../plugins/github/loadGraph", () => ({
  loadGraph: jest.fn(),
}));
const loadGraph: JestMockFn = (require("../plugins/github/loadGraph")
  .loadGraph: any);
jest.mock("../plugins/discourse/loadDiscourse", () => ({
  loadDiscourse: jest.fn(),
}));
const loadDiscourse: JestMockFn = (require("../plugins/discourse/loadDiscourse")
  .loadDiscourse: any);

jest.mock("../analysis/timeline/timelineCred", () => ({
  TimelineCred: {compute: jest.fn()},
}));
const timelineCredCompute: JestMockFn = (require("../analysis/timeline/timelineCred")
  .TimelineCred.compute: any);

describe("api/load", () => {
  const fakeTimelineCred = deepFreeze({
    toJSON: () => ({is: "fake-timeline-cred"}),
  });
  const githubSentinel = node("github-sentinel");
  const githubGraph = () => new Graph().addNode(githubSentinel);
  const discourseSentinel = node("discourse-sentinel");
  const discourseGraph = () => new Graph().addNode(discourseSentinel);
  const combinedGraph = () => Graph.merge([githubGraph(), discourseGraph()]);
  beforeEach(() => {
    jest.clearAllMocks();
    loadGraph.mockResolvedValue(githubGraph());
    loadDiscourse.mockResolvedValue(discourseGraph());
    timelineCredCompute.mockResolvedValue(fakeTimelineCred);
  });
  const discourseServerUrl = "https://example.com";
  const discourseApiUsername = "credbot";
  const project: Project = {
    id: "foo",
    repoIds: [makeRepoId("foo", "bar")],
    discourseServer: {
      serverUrl: discourseServerUrl,
      apiUsername: discourseApiUsername,
    },
  };
  deepFreeze(project);
  const githubToken = "EXAMPLE_TOKEN";
  const discourseKey = "EXAMPLE_KEY";
  const weights = defaultWeights();
  // Tweaks the weights so that we can ensure we aren't overriding with default weights
  weights.nodeManualWeights.set(NodeAddress.empty, 33);
  // Deep freeze will freeze the weights, too
  const params = deepFreeze({alpha: 0.05, intervalDecay: 0.5, weights});
  const example = () => {
    const sourcecredDirectory = tmp.dirSync().name;
    const taskReporter = new TestTaskReporter();
    const options: LoadOptions = {
      sourcecredDirectory,
      githubToken,
      params,
      project,
      discourseKey,
    };
    return {options, taskReporter, sourcecredDirectory};
  };

  it("sets up a project directory for the project", async () => {
    const {options, taskReporter, sourcecredDirectory} = example();
    await load(options, taskReporter);
    expect(await getProjectIds(sourcecredDirectory)).toEqual([project.id]);
    expect(await loadProject(project.id, sourcecredDirectory)).toEqual(project);
  });

  it("calls github loadGraph with the right options", async () => {
    const {options, taskReporter, sourcecredDirectory} = example();
    await load(options, taskReporter);
    const cacheDirectory = path.join(sourcecredDirectory, "cache");
    const expectedLoadGraphOptions: LoadGraphOptions = {
      repoIds: project.repoIds,
      token: githubToken,
      cacheDirectory,
    };
    expect(loadGraph).toHaveBeenCalledWith(
      expectedLoadGraphOptions,
      taskReporter
    );
  });

  it("calls loadDiscourse with the right options", async () => {
    const {options, taskReporter, sourcecredDirectory} = example();
    await load(options, taskReporter);
    const cacheDirectory = path.join(sourcecredDirectory, "cache");
    const expectedOptions: LoadDiscourseOptions = {
      fetchOptions: {
        apiUsername: discourseApiUsername,
        apiKey: discourseKey,
        serverUrl: discourseServerUrl,
      },
      cacheDirectory,
    };
    expect(loadDiscourse).toHaveBeenCalledWith(expectedOptions, taskReporter);
  });

  it("saves a merged graph to disk", async () => {
    const {options, taskReporter, sourcecredDirectory} = example();
    await load(options, taskReporter);
    const projectDirectory = directoryForProjectId(
      project.id,
      sourcecredDirectory
    );
    const graphFile = path.join(projectDirectory, "graph.json");
    const graphJSON = JSON.parse(await fs.readFile(graphFile));
    const expectedJSON = combinedGraph().toJSON();
    expect(graphJSON).toEqual(expectedJSON);
  });

  it("calls TimelineCred.compute with the right graph and options", async () => {
    const {options, taskReporter} = example();
    await load(options, taskReporter);
    expect(timelineCredCompute).toHaveBeenCalledWith(
      expect.anything(),
      params,
      DEFAULT_CRED_CONFIG
    );
    expect(timelineCredCompute.mock.calls[0][0].equals(combinedGraph())).toBe(
      true
    );
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
      {type: "START", taskId: "compute-cred"},
      {type: "FINISH", taskId: "compute-cred"},
      {type: "FINISH", taskId: "load-foo"},
    ]);
  });

  it("errors if a discourse server is provided without a discourse key", () => {
    const {options, taskReporter} = example();
    const optionsWithoutKey = {...options, discourseKey: null};
    expect.assertions(1);
    return load(optionsWithoutKey, taskReporter).catch((e) =>
      expect(e.message).toMatch("no Discourse key")
    );
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
    const newOptions = {...options, project: newProject, discourseKey: null};
    await load(newOptions, taskReporter);
    expect(loadDiscourse).not.toHaveBeenCalled();
    const projectDirectory = directoryForProjectId(
      project.id,
      sourcecredDirectory
    );
    const graphFile = path.join(projectDirectory, "graph.json");
    const graphJSON = JSON.parse(await fs.readFile(graphFile));
    const expectedJSON = githubGraph().toJSON();
    expect(graphJSON).toEqual(expectedJSON);
  });

  it("only loads Discourse if no GitHub repoIds set ", async () => {
    const {options, taskReporter, sourcecredDirectory} = example();
    const newProject = {...options.project, repoIds: []};
    const newOptions = {...options, project: newProject, githubToken: null};
    await load(newOptions, taskReporter);
    expect(loadGraph).not.toHaveBeenCalled();
    const projectDirectory = directoryForProjectId(
      project.id,
      sourcecredDirectory
    );
    const graphFile = path.join(projectDirectory, "graph.json");
    const graphJSON = JSON.parse(await fs.readFile(graphFile));
    const expectedJSON = discourseGraph().toJSON();
    expect(graphJSON).toEqual(expectedJSON);
  });
});
