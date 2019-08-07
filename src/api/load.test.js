// @flow

import deepFreeze from "deep-freeze";
import tmp from "tmp";
import path from "path";
import fs from "fs-extra";

import type {Options as LoadGraphOptions} from "../plugins/github/loadGraph";
import type {Project} from "../core/project";
import {
  directoryForProjectId,
  getProjectIds,
  loadProject,
} from "../core/project_io";
import {makeRepoId} from "../core/repoId";
import {defaultWeights} from "../analysis/weights";
import {NodeAddress} from "../core/graph";
import {TestTaskReporter} from "../util/taskReporter";
import {load, type LoadOptions} from "./load";
import {DEFAULT_CRED_CONFIG} from "../plugins/defaultCredConfig";

type JestMockFn = $Call<typeof jest.fn>;
jest.mock("../plugins/github/loadGraph", () => ({
  loadGraph: jest.fn(),
}));
const loadGraph: JestMockFn = (require("../plugins/github/loadGraph")
  .loadGraph: any);

jest.mock("../analysis/timeline/timelineCred", () => ({
  TimelineCred: {compute: jest.fn()},
}));
const timelineCredCompute: JestMockFn = (require("../analysis/timeline/timelineCred")
  .TimelineCred.compute: any);

describe("api/load", () => {
  const fakeTimelineCred = deepFreeze({
    toJSON: () => ({is: "fake-timeline-cred"}),
  });
  const fakeGraph = deepFreeze({toJSON: () => ({is: "fake-graph"})});
  beforeEach(() => {
    jest.clearAllMocks();
    loadGraph.mockResolvedValue(fakeGraph);
    timelineCredCompute.mockResolvedValue(fakeTimelineCred);
  });
  const project: Project = deepFreeze({
    id: "foo",
    repoIds: [makeRepoId("foo", "bar")],
  });
  const githubToken = "EXAMPLE_TOKEN";
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

  it("saves the resultant graph to disk", async () => {
    const {options, taskReporter, sourcecredDirectory} = example();
    await load(options, taskReporter);
    const projectDirectory = directoryForProjectId(
      project.id,
      sourcecredDirectory
    );
    const graphFile = path.join(projectDirectory, "graph.json");
    const graphJSON = JSON.parse(await fs.readFile(graphFile));
    expect(graphJSON).toEqual(fakeGraph.toJSON());
  });

  it("calls TimelineCred.compute with the right graph and options", async () => {
    const {options, taskReporter} = example();
    await load(options, taskReporter);
    expect(timelineCredCompute).toHaveBeenCalledWith(
      fakeGraph,
      params,
      DEFAULT_CRED_CONFIG
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
});
