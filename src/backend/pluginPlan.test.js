// @flow

import {Graph} from "../core/graph";
import {node as graphNode} from "../core/graphTestUtil";
import {createProject} from "../core/project";
import {TestTaskReporter} from "../util/taskReporter";
import {pluginMirrorPlan, pluginGraphPlan} from "./pluginPlan";

const githubSentinel = graphNode("github-sentinel");
const githubGraph = () => new Graph().addNode(githubSentinel);
const discourseSentinel = graphNode("discourse-sentinel");
const discourseGraph = () => new Graph().addNode(discourseSentinel);
const combinedGraph = () => Graph.merge([githubGraph(), discourseGraph()]);

const mockCacheProvider = () => ({
  database: jest.fn(),
});

const mockPluginLoaders = () => ({
  github: {
    updateMirror: jest.fn(),
    createGraph: jest.fn().mockResolvedValue(githubGraph()),
  },
  discourse: {
    updateMirror: jest.fn(),
    createGraph: jest.fn().mockResolvedValue(discourseGraph()),
  },
  identity: {
    contractGraph: jest.fn().mockResolvedValue(combinedGraph()),
  },
});

describe("src/backend/pluginPlan", () => {
  describe("pluginMirrorPlan", () => {
    it("should update discourse mirror", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const reporter = new TestTaskReporter();
      const ghToken = null;
      const project = createProject({
        id: "has-discourse",
        discourseServer: {serverUrl: "http://foo.bar"},
      });

      // When
      const mirror = pluginMirrorPlan(loaders, ghToken, cache, reporter);
      await mirror(project);

      // Then
      const {discourse, github, identity} = loaders;
      expect(discourse.updateMirror).toBeCalledTimes(1);
      expect(discourse.updateMirror).toBeCalledWith(
        project.discourseServer,
        cache,
        reporter
      );
      expect(discourse.createGraph).toBeCalledTimes(0);
      expect(github.updateMirror).toBeCalledTimes(0);
      expect(github.createGraph).toBeCalledTimes(0);
      expect(identity.contractGraph).toBeCalledTimes(0);
    });

    it("should fail when missing GithubToken", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const ghToken = null;
      const reporter = new TestTaskReporter();
      const project = createProject({
        id: "has-github",
        repoIds: ([{owner: "sourcecred-test", name: "example-github"}]: any),
      });

      // When
      const mirror = pluginMirrorPlan(loaders, ghToken, cache, reporter);
      const p = mirror(project);

      // Then
      const {discourse, github, identity} = loaders;
      await expect(p).rejects.toThrow("GithubToken not set");
      expect(discourse.updateMirror).toBeCalledTimes(0);
      expect(discourse.createGraph).toBeCalledTimes(0);
      expect(github.updateMirror).toBeCalledTimes(0);
      expect(github.createGraph).toBeCalledTimes(0);
      expect(identity.contractGraph).toBeCalledTimes(0);
    });

    it("should update github mirror", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const ghToken = ("t000ken": any);
      const reporter = new TestTaskReporter();
      const project = createProject({
        id: "has-github",
        repoIds: ([{owner: "sourcecred-test", name: "example-github"}]: any),
      });

      // When
      const mirror = pluginMirrorPlan(loaders, ghToken, cache, reporter);
      await mirror(project);

      // Then
      const {discourse, github, identity} = loaders;
      expect(discourse.updateMirror).toBeCalledTimes(0);
      expect(discourse.createGraph).toBeCalledTimes(0);
      expect(github.updateMirror).toBeCalledTimes(1);
      expect(github.updateMirror).toBeCalledWith(
        project.repoIds,
        "t000ken",
        cache,
        reporter
      );
      expect(github.createGraph).toBeCalledTimes(0);
      expect(identity.contractGraph).toBeCalledTimes(0);
    });
  });

  describe("pluginGraphPlan", () => {
    it("should update discourse graph", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const ghToken = null;
      const project = createProject({
        id: "has-discourse",
        discourseServer: {serverUrl: "http://foo.bar"},
      });

      // When
      const createGraph = pluginGraphPlan(loaders, ghToken, cache);
      const graph = await createGraph(project);

      // Then
      const {discourse, github, identity} = loaders;
      expect(graph).toEqual(discourseGraph());
      expect(discourse.updateMirror).toBeCalledTimes(0);
      expect(discourse.createGraph).toBeCalledTimes(1);
      expect(discourse.createGraph).toBeCalledWith(
        project.discourseServer,
        cache
      );
      expect(github.updateMirror).toBeCalledTimes(0);
      expect(github.createGraph).toBeCalledTimes(0);
      expect(identity.contractGraph).toBeCalledTimes(0);
    });

    it("fail when missing GithubToken", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const ghToken = null;
      const project = createProject({
        id: "has-github",
        repoIds: ([{owner: "sourcecred-test", name: "example-github"}]: any),
      });

      // When
      const createGraph = pluginGraphPlan(loaders, ghToken, cache);
      const p = createGraph(project);

      // Then
      const {discourse, github, identity} = loaders;
      await expect(p).rejects.toThrow("GithubToken not set");
      expect(discourse.updateMirror).toBeCalledTimes(0);
      expect(discourse.createGraph).toBeCalledTimes(0);
      expect(github.updateMirror).toBeCalledTimes(0);
      expect(github.createGraph).toBeCalledTimes(0);
      expect(identity.contractGraph).toBeCalledTimes(0);
    });

    it("should update github graph", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const ghToken = ("t000ken": any);
      const project = createProject({
        id: "has-github",
        repoIds: ([{owner: "sourcecred-test", name: "example-github"}]: any),
      });

      // When
      const createGraph = pluginGraphPlan(loaders, ghToken, cache);
      const graph = await createGraph(project);

      // Then
      const {discourse, github, identity} = loaders;
      expect(graph).toEqual(githubGraph());
      expect(discourse.updateMirror).toBeCalledTimes(0);
      expect(discourse.createGraph).toBeCalledTimes(0);
      expect(github.updateMirror).toBeCalledTimes(0);
      expect(github.createGraph).toBeCalledTimes(1);
      expect(github.createGraph).toBeCalledWith(
        project.repoIds,
        "t000ken",
        cache
      );
      expect(identity.contractGraph).toBeCalledTimes(0);
    });
  });
});
