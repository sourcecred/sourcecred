// @flow

import {projectToJSON, projectFromJSON, type Project} from "./project";

import {makeRepoId} from "./repoId";

describe("core/project.js", () => {
  const foobar = Object.freeze(makeRepoId("foo", "bar"));
  const foozod = Object.freeze(makeRepoId("foo", "zod"));
  const p1: Project = Object.freeze({
    id: "foo/bar",
    repoIds: Object.freeze([foobar]),
  });
  const p2: Project = Object.freeze({
    id: "@foo",
    repoIds: Object.freeze([foobar, foozod]),
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
});
