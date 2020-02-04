// @flow

import {createProject} from "../core/project";
import {makeRepoId} from "../plugins/github/repoId";
import * as PluginLoaders from "./pluginLoaders";

const fakeGithubDec = ("fake-github-dec": any);
const fakeDiscourseDec = ("fake-discourse-dec": any);
const fakeIdentityDec = ("fake-identity-dec": any);

const mockPluginLoaders = () => ({
  github: {
    declaration: jest.fn().mockReturnValue(fakeGithubDec),
  },
  discourse: {
    declaration: jest.fn().mockReturnValue(fakeDiscourseDec),
  },
  identity: {
    declaration: jest.fn().mockReturnValue(fakeIdentityDec),
  },
});

describe("src/backend/pluginLoaders", () => {
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
});
