// @flow

import {makeRepo, stringToRepo, repoToString, type Repo} from "./repo";

describe("core/repo", () => {
  describe("Repo type", () => {
    it("manually constructing a Repo is illegal", () => {
      // $ExpectFlowError
      const _unused_repo: Repo = {owner: "foo", name: "bar"};
    });
    it("destructuring repo properties is legal", () => {
      const repo: Repo = makeRepo("foo", "bar");
      const _unused_owner: string = repo.owner;
      const _unused_name: string = repo.name;
    });
  });
  describe("makeRepoRepo", () => {
    it("allows a simple repo", () => {
      makeRepo("sourcecred", "sourcecred");
    });
    it("allows a repo with periods in name", () => {
      makeRepo("sourcecred", "sourcecred.github.io");
    });
    it("allows a repo with hyphens", () => {
      makeRepo("foo", "something-good");
    });
    it("disallows a repo with no owner", () => {
      expect(() => makeRepo("", "foo")).toThrow("Invalid");
    });
    it("disallows a repo with no name", () => {
      expect(() => makeRepo("foo", "")).toThrow("Invalid");
    });
    it("disallows a repo with underscores", () => {
      expect(() => makeRepo("yep", "something_bad")).toThrow("Invalid");
    });
  });
  describe("repo<->string", () => {
    function testInvertible(owner, name) {
      const repo = makeRepo(owner, name);
      const string = `${owner}/${name}`;
      expect(stringToRepo(string)).toEqual(repo);
      expect(repoToString(repo)).toEqual(string);
    }
    it("works for simple case", () => {
      testInvertible("sourcecred", "sourcecred");
    });
    it("works for a complicated case", () => {
      testInvertible("fooolio", "foo-bar.bar-99");
    });
  });
});
