// @flow

import {
  makeRepoId,
  stringToRepoId,
  repoIdToString,
  type RepoId,
  type RepoIdString,
} from "./repoId";

describe("plugins/github/repoId", () => {
  describe("RepoId type", () => {
    it("manually constructing a RepoId is illegal", () => {
      // $FlowExpectedError[incompatible-type]
      const _unused_repoId: RepoId = {
        owner: "foo",
        name: "bar",
      };
    });
    it("destructuring repoId properties is legal", () => {
      const repoId: RepoId = makeRepoId("foo", "bar");
      const _unused_owner: string = repoId.owner;
      const _unused_name: string = repoId.name;
    });
  });
  describe("RepoIdString type", () => {
    it("manually constructing a RepoIdString is illegal", () => {
      // $FlowExpectedError[incompatible-type]
      const _unused_repoIdString: RepoIdString = "foobar";
    });
  });
  describe("makeRepoId", () => {
    it("allows a simple repoId", () => {
      makeRepoId("sourcecred", "sourcecred");
    });
    it("allows a repoId with periods in name", () => {
      makeRepoId("sourcecred", "sourcecred.github.io");
    });
    it("allows a repoId with hyphens", () => {
      makeRepoId("foo", "something-good");
    });
    it("disallows a repoId with no owner", () => {
      expect(() => makeRepoId("", "foo")).toThrow("Invalid");
    });
    it("disallows a repoId with no name", () => {
      expect(() => makeRepoId("foo", "")).toThrow("Invalid");
    });
    it("disallows an owner with periods", () => {
      expect(() => makeRepoId("fo.o", "bar")).toThrow("Invalid");
    });
    it("disallows an owner with underscores", () => {
      expect(() => makeRepoId("fo_o", "bar")).toThrow("Invalid");
    });
    it("allows a repoId with underscores", () => {
      makeRepoId("foo", "still_good");
    });
  });
  describe("repoId<->string", () => {
    function testInvertible(owner, name) {
      const repoId = makeRepoId(owner, name);
      const string = `${owner}/${name}`;
      expect(stringToRepoId(string)).toEqual(repoId);
      expect(repoIdToString(repoId)).toEqual(string);
    }
    it("works for simple case", () => {
      testInvertible("sourcecred", "sourcecred");
    });
    it("works for a complicated case", () => {
      testInvertible("fooolio", "foo-bar.bar-99_x");
    });
  });
});
