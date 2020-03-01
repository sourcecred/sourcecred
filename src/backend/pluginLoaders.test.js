// @flow

import {type CacheProvider} from "./cache";
import {
  type ReferenceDetector,
  CascadingReferenceDetector,
} from "../core/references";
import * as WeightedGraph from "../core/weightedGraph";
import {node as graphNode} from "../core/graphTestUtil";
import {createProject} from "../core/project";
import {TestTaskReporter} from "../util/taskReporter";
import {validateToken} from "../plugins/github/token";
import {makeRepoId} from "../plugins/github/repoId";
import * as PluginLoaders from "./pluginLoaders";
import {type LoadedInitiativesDirectory} from "../plugins/initiatives/initiativesDirectory";

export function createWG(name: string) {
  const weightedGraph = WeightedGraph.empty();
  weightedGraph.graph.addNode(graphNode(`${name}-sentinel`));
  return weightedGraph;
}

const mockGraphs = {
  github: createWG("github"),
  discourse: createWG("discourse"),
  initiatives: createWG("initiatives"),
  contracted: createWG("identity-contracted"),
};

const fakes = {
  githubDeclaration: ({fake: "githubDeclaration"}: any),
  githubReferences: ({fake: "githubReferences"}: any),
  discourseDeclaration: ({fake: "discourseDeclaration"}: any),
  discourseReferences: ({fake: "discourseReferences"}: any),
  identityDeclaration: ({fake: "identityDeclaration"}: any),
  initiativesDeclaration: ({fake: "initiativesDeclaration"}: any),
  initiativesReferences: ({fake: "initiativesReferences"}: any),
  initiativesRepository: ({fake: "initiativesRepository"}: any),
};

const mockLoadedDirectory = (): LoadedInitiativesDirectory =>
  ({
    referenceDetector: fakes.initiativesReferences,
    initiatives: fakes.initiativesRepository,
  }: any);

const mockCacheProvider = (): CacheProvider => ({
  database: jest.fn(),
});

const mockReferenceDetector = (): ReferenceDetector => ({
  addressFromUrl: jest.fn(),
});

const mockPluginLoaders = () => ({
  github: {
    declaration: jest.fn().mockReturnValue(fakes.githubDeclaration),
    updateMirror: jest.fn(),
    referenceDetector: jest.fn().mockResolvedValue(fakes.githubReferences),
    createGraph: jest.fn().mockResolvedValue(mockGraphs.github),
  },
  discourse: {
    declaration: jest.fn().mockReturnValue(fakes.discourseDeclaration),
    updateMirror: jest.fn(),
    referenceDetector: jest.fn().mockResolvedValue(fakes.discourseReferences),
    createGraph: jest.fn().mockResolvedValue(mockGraphs.discourse),
  },
  identity: {
    declaration: jest.fn().mockReturnValue(fakes.identityDeclaration),
    contractIdentities: jest.fn().mockReturnValue(mockGraphs.contracted),
  },
  initiatives: {
    declaration: jest.fn().mockReturnValue(fakes.initiativesDeclaration),
    loadDirectory: jest.fn().mockResolvedValue(mockLoadedDirectory()),
    createGraph: jest.fn().mockResolvedValue(mockGraphs.initiatives),
  },
});

describe("src/backend/pluginLoaders", () => {
  const exampleGithubToken = validateToken("0".repeat(40));
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

    it("should include initiatives declaration", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const project = createProject({
        id: "has-initiatives",
        initiatives: {remoteUrl: "http://example.com/initiatives"},
      });

      // When
      const decs = PluginLoaders.declarations(loaders, project);

      // Then
      expect(decs).toEqual([fakes.initiativesDeclaration]);
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
      const initiativesDirectory = null;
      const project = createProject({
        id: "has-discourse",
        discourseServer: {serverUrl: "http://foo.bar"},
      });

      // When
      await PluginLoaders.updateMirror(
        loaders,
        {githubToken, cache, reporter, initiativesDirectory},
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

    it("should fail when missing initiativesDirectory", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const githubToken = null;
      const initiativesDirectory = null;
      const reporter = new TestTaskReporter();
      const project = createProject({
        id: "has-initiatives",
        initiatives: {remoteUrl: "http://example.com/initiatives"},
      });

      // When
      const p = PluginLoaders.updateMirror(
        loaders,
        {githubToken, cache, reporter, initiativesDirectory},
        project
      );

      // Then
      await expect(p).rejects.toThrow(
        "Tried to load Initiatives, but no Initiatives directory set"
      );
    });

    it("should load initiatives directory", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const reporter = new TestTaskReporter();
      const githubToken = null;
      const initiativesDirectory = __dirname;
      const project = createProject({
        id: "has-initiatives",
        initiatives: {remoteUrl: "http://example.com/initiatives"},
      });

      // When
      await PluginLoaders.updateMirror(
        loaders,
        {githubToken, cache, reporter, initiativesDirectory},
        project
      );

      // Then
      const {initiatives} = loaders;
      expect(initiatives.loadDirectory).toBeCalledTimes(1);
      expect(initiatives.loadDirectory).toBeCalledWith(
        {
          localPath: initiativesDirectory,
          remoteUrl: "http://example.com/initiatives",
        },
        reporter
      );
    });

    it("should fail when missing GithubToken", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const githubToken = null;
      const initiativesDirectory = null;
      const reporter = new TestTaskReporter();
      const project = createProject({
        id: "has-github",
        repoIds: [exampleRepoId],
      });

      // When
      const p = PluginLoaders.updateMirror(
        loaders,
        {githubToken, cache, reporter, initiativesDirectory},
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
      const reporter = new TestTaskReporter();
      const initiativesDirectory = null;
      const project = createProject({
        id: "has-github",
        repoIds: [exampleRepoId],
      });

      // When
      await PluginLoaders.updateMirror(
        loaders,
        {githubToken, cache, reporter, initiativesDirectory},
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
      const references = mockReferenceDetector();
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const githubToken = null;
      const project = createProject({
        id: "has-discourse",
        discourseServer: {serverUrl: "http://foo.bar"},
      });
      const cachedProject = ({project, cache}: any);

      // When
      const pluginGraphs = await PluginLoaders.createPluginGraphs(
        loaders,
        {githubToken},
        cachedProject,
        references
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

    it("should create initiatives graph", async () => {
      // Given
      const references = mockReferenceDetector();
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const loadedInitiativesDirectory = mockLoadedDirectory();
      const githubToken = null;
      const project = createProject({
        id: "has-initiatives",
        initiatives: {remoteUrl: "http://example.com/initiatives"},
      });
      const cachedProject = ({project, cache, loadedInitiativesDirectory}: any);

      // When
      const pluginGraphs = await PluginLoaders.createPluginGraphs(
        loaders,
        {githubToken},
        cachedProject,
        references
      );

      // Then
      const {initiatives} = loaders;
      expect(pluginGraphs).toEqual({
        graphs: [mockGraphs.initiatives],
        cachedProject,
      });
      expect(initiatives.createGraph).toBeCalledTimes(1);
      expect(initiatives.createGraph).toBeCalledWith(
        loadedInitiativesDirectory.initiatives,
        references
      );
    });

    it("fail when missing GithubToken", async () => {
      // Given
      const references = mockReferenceDetector();
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const githubToken = null;
      const project = createProject({
        id: "has-github",
        repoIds: [exampleRepoId],
      });
      const cachedProject = ({project, cache}: any);

      // When
      const p = PluginLoaders.createPluginGraphs(
        loaders,
        {githubToken},
        cachedProject,
        references
      );

      // Then
      await expect(p).rejects.toThrow(
        "Tried to load GitHub, but no GitHub token set"
      );
    });

    it("should create github graph", async () => {
      // Given
      const references = mockReferenceDetector();
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const githubToken = exampleGithubToken;
      const project = createProject({
        id: "has-github",
        repoIds: [exampleRepoId],
      });
      const cachedProject = ({project, cache}: any);

      // When
      const pluginGraphs = await PluginLoaders.createPluginGraphs(
        loaders,
        {githubToken},
        cachedProject,
        references
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

  describe("createReferenceDetector", () => {
    it("should create a CascadingReferenceDetector", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const githubToken = exampleGithubToken;
      const loadedInitiativesDirectory = mockLoadedDirectory();
      const project = createProject({
        id: "has-github-discourse-initiatives",
        discourseServer: {serverUrl: "http://foo.bar"},
        initiatives: {remoteUrl: "http://example.com/initiatives"},
        repoIds: [exampleRepoId],
      });
      const cachedProject = ({project, cache, loadedInitiativesDirectory}: any);

      // When
      const references = await PluginLoaders.createReferenceDetector(
        loaders,
        {githubToken},
        cachedProject
      );

      // Then
      expect(references).toBeInstanceOf(CascadingReferenceDetector);
      expect(((references: any): CascadingReferenceDetector).refs).toEqual([
        fakes.githubReferences,
        fakes.discourseReferences,
        fakes.initiativesReferences,
      ]);
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
