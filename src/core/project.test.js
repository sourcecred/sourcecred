// @flow

import base64url from "base64url";
import deepFreeze from "deep-freeze";
import {
  projectToJSON,
  projectFromJSON,
  type Project,
  encodeProjectId,
} from "./project";

import {makeRepoId} from "./repoId";
import {toCompat} from "../util/compat";

describe("core/project", () => {
  const foobar = deepFreeze(makeRepoId("foo", "bar"));
  const foozod = deepFreeze(makeRepoId("foo", "zod"));
  const p1: Project = deepFreeze({
    id: "foo/bar",
    repoIds: [foobar],
    discourseServer: null,
    identities: [],
  });
  const p2: Project = deepFreeze({
    id: "@foo",
    repoIds: [foobar, foozod],
    discourseServer: {serverUrl: "https://example.com"},
    identities: [
      {
        username: "example",
        aliases: ["github/example"],
      },
    ],
  });
  describe("to/from JSON", () => {
    it("round trip is identity", () => {
      function check(p: Project) {
        const json = projectToJSON(p);
        const p_ = projectFromJSON(json);
        expect(p).toEqual(p_);
      }
      check(p1);
      check(p2);
    });
    it("should upgrade from 0.3.0 formatting", () => {
      // Given
      const body = {
        id: "example-030",
        repoIds: [foobar, foozod],
        discourseServer: {
          serverUrl: "https://example.com",
          apiUsername: "hello-test",
        },
        identities: [],
      };
      const compat = toCompat(
        {type: "sourcecred/project", version: "0.3.0"},
        body
      );

      // When
      const project = projectFromJSON(compat);

      // Then
      expect(project).toEqual({
        ...body,
        // It should strip the apiUsername field, keeping just serverUrl.
        discourseServer: {serverUrl: "https://example.com"},
      });
    });
    it("should upgrade from 0.3.1 formatting", () => {
      // Given
      const body = {
        id: "example-031",
        repoIds: [foobar, foozod],
        discourseServer: {
          serverUrl: "https://example.com",
          apiUsername: "hello-test",
        },
        identities: [],
      };
      const compat = toCompat(
        {type: "sourcecred/project", version: "0.3.1"},
        body
      );

      // When
      const project = projectFromJSON(compat);

      // Then
      expect(project).toEqual({
        ...body,
        // It should strip the apiUsername field, keeping just serverUrl.
        discourseServer: {serverUrl: "https://example.com"},
      });
    });
  });
  describe("encodeProjectId", () => {
    it("is a base64-url encoded id", () => {
      const project = {id: "foo bar", repoIds: []};
      const encoded = encodeProjectId(project.id);
      expect(encoded).toEqual(base64url.encode("foo bar"));
    });
    it("is decodable to identity", () => {
      expect(base64url.decode(encodeProjectId("foo bar"))).toEqual("foo bar");
    });
  });
});
