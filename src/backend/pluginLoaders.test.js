// @flow

import {type CacheProvider} from "./cache";
import * as WeightedGraph from "../core/weightedGraph";
import {node as graphNode} from "../core/graphTestUtil";
import {createProject} from "../core/project";
import {TestTaskReporter} from "../util/taskReporter";
import {validateToken} from "../plugins/github/token";
import {makeRepoId} from "../plugins/github/repoId";
import * as PluginLoaders from "./pluginLoaders";

export function createWG(name: string) {
  const weightedGraph = WeightedGraph.empty();
  weightedGraph.graph.addNode(graphNode(`${name}-sentinel`));
  return weightedGraph;
}

const mockGraphs = {
  github: createWG("github"),
  discord: createWG("discord"),
  discourse: createWG("discourse"),
  contracted: createWG("identity-contracted"),
};

const fakes = {
  githubDeclaration: ({fake: "githubDeclaration"}: any),
  discordDeclaration: ({fake: "discordDeclaration"}: any),
  discourseDeclaration: ({fake: "discourseDeclaration"}: any),
  identityDeclaration: ({fake: "identityDeclaration"}: any),
};

const mockCacheProvider = (): CacheProvider => ({
  database: jest.fn(),
});

const mockPluginLoaders = () => ({
  github: {
    declaration: jest.fn().mockReturnValue(fakes.githubDeclaration),
    updateMirror: jest.fn(),
    createGraph: jest.fn().mockResolvedValue(mockGraphs.github),
  },
  discord: {
    declaration: jest.fn().mockReturnValue(fakes.discordDeclaration),
    updateMirror: jest.fn(),
    createGraph: jest.fn().mockResolvedValue(mockGraphs.discord),
  },
  discourse: {
    declaration: jest.fn().mockReturnValue(fakes.discourseDeclaration),
    updateMirror: jest.fn(),
    createGraph: jest.fn().mockResolvedValue(mockGraphs.discourse),
  },
  identity: {
    declaration: jest.fn().mockReturnValue(fakes.identityDeclaration),
    contractIdentities: jest.fn().mockReturnValue(mockGraphs.contracted),
  },
});

describe("src/backend/pluginLoaders", () => {
  const exampleGithubToken = validateToken("0".repeat(40));
  const exampleDiscordToken = "fakeBotToken";
  const exampleRepoId = makeRepoId("sourcecred-test", "example-github");

  describe("declarations", () => {
    it("should include discourse declaration", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const project = createProject({
        id: "has-discourse",
        discourseServer: {serverUrl: "http://foo.bar"},
      });

      // When
      const decs = PluginLoaders.declarations(loaders, project);

      // Then
      expect(decs).toEqual([fakes.discourseDeclaration]);
    });

    it("should include github declaration", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const project = createProject({
        id: "has-github",
        repoIds: [exampleRepoId],
      });

      // When
      const decs = PluginLoaders.declarations(loaders, project);

      // Then
      expect(decs).toEqual([fakes.githubDeclaration]);
    });

    it("should include identity declaration", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const project = createProject({
        id: "has-identity",
        identities: [{username: "foo", aliases: ["github/foo"]}],
      });

      // When
      const decs = PluginLoaders.declarations(loaders, project);

      // Then
      expect(decs).toEqual([fakes.identityDeclaration]);
    });
  });

  describe("updateMirror", () => {
    it("should update discourse mirror", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const reporter = new TestTaskReporter();
      const githubToken = null;
      const discordToken = null;
      const project = createProject({
        id: "has-discourse",
        discourseServer: {serverUrl: "http://foo.bar"},
      });

      // When
      await PluginLoaders.updateMirror(
        loaders,
        {githubToken, discordToken, cache, reporter},
        project
      );

      // Then
      const {discourse} = loaders;
      expect(discourse.updateMirror).toBeCalledTimes(1);
      expect(discourse.updateMirror).toBeCalledWith(
        project.discourseServer,
        cache,
        reporter
      );
    });

    it("should fail when missing GithubToken", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const githubToken = null;
      const discordToken = null;
      const reporter = new TestTaskReporter();
      const project = createProject({
        id: "has-github",
        repoIds: [exampleRepoId],
      });

      // When
      const p = PluginLoaders.updateMirror(
        loaders,
        {githubToken, discordToken, cache, reporter},
        project
      );

      // Then
      await expect(p).rejects.toThrow(
        "Tried to load GitHub, but no GitHub token set"
      );
    });

    it("should update github mirror", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const githubToken = exampleGithubToken;
      const discordToken = null;
      const reporter = new TestTaskReporter();
      const project = createProject({
        id: "has-github",
        repoIds: [exampleRepoId],
      });

      // When
      await PluginLoaders.updateMirror(
        loaders,
        {githubToken, discordToken, cache, reporter},
        project
      );

      // Then
      const {github} = loaders;
      expect(github.updateMirror).toBeCalledTimes(1);
      expect(github.updateMirror).toBeCalledWith(
        project.repoIds,
        githubToken,
        cache,
        reporter
      );
    });
  });

  describe("createPluginGraphs", () => {
    it("should create discourse graph", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const githubToken = null;
      const discordToken = null;
      const project = createProject({
        id: "has-discourse",
        discourseServer: {serverUrl: "http://foo.bar"},
      });
      const cachedProject = ({project, cache}: any);

      // When
      const pluginGraphs = await PluginLoaders.createPluginGraphs(
        loaders,
        {githubToken, discordToken},
        cachedProject
      );

      // Then
      const {discourse} = loaders;
      expect(pluginGraphs).toEqual({
        graphs: [mockGraphs.discourse],
        cachedProject,
      });
      expect(discourse.createGraph).toBeCalledTimes(1);
      expect(discourse.createGraph).toBeCalledWith(
        project.discourseServer,
        cache
      );
    });

    it("fail when missing GithubToken", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const githubToken = null;
      const discordToken = null;
      const project = createProject({
        id: "has-github",
        repoIds: [exampleRepoId],
      });
      const cachedProject = ({project, cache}: any);

      // When
      const p = PluginLoaders.createPluginGraphs(
        loaders,
        {githubToken, discordToken},
        cachedProject
      );

      // Then
      await expect(p).rejects.toThrow(
        "Tried to load GitHub, but no GitHub token set"
      );
    });

    it("should create github graph", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const githubToken = exampleGithubToken;
      const discordToken = null;
      const project = createProject({
        id: "has-github",
        repoIds: [exampleRepoId],
      });
      const cachedProject = ({project, cache}: any);

      // When
      const pluginGraphs = await PluginLoaders.createPluginGraphs(
        loaders,
        {githubToken, discordToken},
        cachedProject
      );

      // Then
      const {github} = loaders;
      expect(pluginGraphs).toEqual({
        graphs: [mockGraphs.github],
        cachedProject,
      });
      expect(github.createGraph).toBeCalledTimes(1);
      expect(github.createGraph).toBeCalledWith(
        project.repoIds,
        githubToken,
        cache
      );
    });
  });

  describe("contractPluginGraphs", () => {
    it("should only merge graphs when no identities are defined", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const project = createProject({
        id: "has-github-and-discourse",
        discourseServer: {serverUrl: "http://foo.bar"},
        repoIds: [exampleRepoId],
      });
      const pluginGraphs = ({
        graphs: [mockGraphs.github, mockGraphs.discourse],
        cachedProject: {project, cache},
      }: any);

      // When
      const graph = await PluginLoaders.contractPluginGraphs(
        loaders,
        pluginGraphs
      );

      // Then
      const expectedGraph = WeightedGraph.merge([
        mockGraphs.github,
        mockGraphs.discourse,
      ]);
      expect(graph).toEqual(expectedGraph);
    });

    it("should contract identities when they are defined", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const project = createProject({
        id: "has-github-and-discourse-and-identity",
        identities: [{username: "foo", aliases: ["github/foo"]}],
        discourseServer: {serverUrl: "http://foo.bar"},
        repoIds: [exampleRepoId],
      });
      const pluginGraphs = ({
        graphs: [mockGraphs.github, mockGraphs.discourse],
        cachedProject: {project, cache},
      }: any);

      // When
      const graph = await PluginLoaders.contractPluginGraphs(
        loaders,
        pluginGraphs
      );

      // Then
      const {identity} = loaders;
      const expectedGraph = WeightedGraph.merge([
        mockGraphs.github,
        mockGraphs.discourse,
      ]);
      expect(graph).toEqual(mockGraphs.contracted);
      expect(identity.contractIdentities).toBeCalledTimes(1);
      expect(identity.contractIdentities).toBeCalledWith(expectedGraph, {
        identities: project.identities,
        discourseServerUrl: (project.discourseServer: any).serverUrl,
      });
    });
  });
});
