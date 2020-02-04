// @flow

import {createProject} from "../core/project";
import {TestTaskReporter} from "../util/taskReporter";
import {validateToken} from "../plugins/github/token";
import {makeRepoId} from "../plugins/github/repoId";
import * as PluginLoaders from "./pluginLoaders";

const mockCacheProvider = () => ({
  database: jest.fn(),
});

const fakeGithubDec = ("fake-github-dec": any);
const fakeDiscourseDec = ("fake-discourse-dec": any);
const fakeIdentityDec = ("fake-identity-dec": any);

const mockPluginLoaders = () => ({
  github: {
    declaration: jest.fn().mockReturnValue(fakeGithubDec),
    updateMirror: jest.fn(),
  },
  discourse: {
    declaration: jest.fn().mockReturnValue(fakeDiscourseDec),
    updateMirror: jest.fn(),
  },
  identity: {
    declaration: jest.fn().mockReturnValue(fakeIdentityDec),
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
      expect(decs).toEqual([fakeDiscourseDec]);
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
      expect(decs).toEqual([fakeGithubDec]);
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
      expect(decs).toEqual([fakeIdentityDec]);
    });
  });

  describe("updateMirror", () => {
    it("should update discourse mirror", async () => {
      // Given
      const loaders = mockPluginLoaders();
      const cache = mockCacheProvider();
      const reporter = new TestTaskReporter();
      const githubToken = null;
      const project = createProject({
        id: "has-discourse",
        discourseServer: {serverUrl: "http://foo.bar"},
      });

      // When
      await PluginLoaders.updateMirror(
        loaders,
        {githubToken, cache, reporter},
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
      const reporter = new TestTaskReporter();
      const project = createProject({
        id: "has-github",
        repoIds: [exampleRepoId],
      });

      // When
      const p = PluginLoaders.updateMirror(
        loaders,
        {githubToken, cache, reporter},
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
      const project = createProject({
        id: "has-github",
        repoIds: [exampleRepoId],
      });

      // When
      await PluginLoaders.updateMirror(
        loaders,
        {githubToken, cache, reporter},
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
});
