// @flow

import {makeRepoId, repoIdToString} from "./repoId";
import {type CacheId, cacheIdForRepoId} from "./cacheId";

describe("plugins/github/cacheId", () => {
  const sampleRepo = makeRepoId("foo", "bar");

  describe("CacheId type", () => {
    it("manually constructing a CacheId is illegal", () => {
      // $ExpectFlowError
      const _unused_cacheId: CacheId = "foo/bar";
    });
    it("casting CacheId to string is legal", () => {
      const _unused_cacheIdString: string = cacheIdForRepoId(sampleRepo);
    });
  });

  describe("cacheIdForRepoId", () => {
    it("should allow a repoId", () => {
      cacheIdForRepoId(sampleRepo);
    });
    it("should start with a 'github_' prefix", () => {
      const id = cacheIdForRepoId(sampleRepo);
      expect(id).toMatch(/^github_/);
    });
    it("should contain a hex encoding of 'repoIdToString'", () => {
      const id = cacheIdForRepoId(sampleRepo);
      const repoIdString = repoIdToString(sampleRepo);
      const expectedHex = Buffer.from(repoIdString).toString("hex");
      expect(id).toContain(expectedHex);
    });
    it("should treat repoId as case sensitive", () => {
      const lowercaseId = cacheIdForRepoId(makeRepoId("foo", "bar"));
      const upperOwnerId = cacheIdForRepoId(makeRepoId("FOO", "bar"));
      const upperNameId = cacheIdForRepoId(makeRepoId("foo", "BAR"));
      expect(upperOwnerId).not.toEqual(lowercaseId);
      expect(upperNameId).not.toEqual(lowercaseId);
    });
    it("should have lowercase output", () => {
      const lowercaseId = cacheIdForRepoId(makeRepoId("foo", "bar"));
      const upperOwnerId = cacheIdForRepoId(makeRepoId("FOO", "bar"));
      const upperNameId = cacheIdForRepoId(makeRepoId("foo", "BAR"));
      expect(lowercaseId).not.toMatch(/[A-Z]/);
      expect(upperOwnerId).not.toMatch(/[A-Z]/);
      expect(upperNameId).not.toMatch(/[A-Z]/);
    });
    it("should deterministically match examples", () => {
      const ids = [
        cacheIdForRepoId(makeRepoId("sourcecred", "sourcecred")),
        cacheIdForRepoId(makeRepoId("sourcecred", "sourcecred.github.io")),
        cacheIdForRepoId(makeRepoId("foo", "Something-Good")),
        cacheIdForRepoId(makeRepoId("foo", "still_good")),
        cacheIdForRepoId(makeRepoId("fooolio", "foo-bar.bar-99_x")),
        cacheIdForRepoId(makeRepoId("FOOolio", "foo-bar.bar-99_x")),
      ];
      expect(ids).toMatchInlineSnapshot(`
        Array [
          "github_736f75726365637265642f736f7572636563726564",
          "github_736f75726365637265642f736f75726365637265642e6769746875622e696f",
          "github_666f6f2f536f6d657468696e672d476f6f64",
          "github_666f6f2f7374696c6c5f676f6f64",
          "github_666f6f6f6c696f2f666f6f2d6261722e6261722d39395f78",
          "github_464f4f6f6c696f2f666f6f2d6261722e6261722d39395f78",
        ]
      `);
    });
  });
});
