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

describe("core/project", () => {
  const foobar = deepFreeze(makeRepoId("foo", "bar"));
  const foozod = deepFreeze(makeRepoId("foo", "zod"));
  const p1: Project = deepFreeze({
    id: "foo/bar",
    repoIds: [foobar],
    discourseServer: null,
  });
  const p2: Project = deepFreeze({
    id: "@foo",
    repoIds: [foobar, foozod],
    discourseServer: {serverUrl: "https://example.com", apiUsername: "credbot"},
  });
  describe("to/fro JSON", () => {
    it("round trip is identity", () => {
      function check(p: Project) {
        const json = projectToJSON(p);
        const p_ = projectFromJSON(json);
        expect(p).toEqual(p_);
      }
      check(p1);
      check(p2);
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
