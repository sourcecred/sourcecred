// @flow

import {makeRepoId, type RepoId} from "./repoId";
import {type CacheId, cacheIdForRepoId} from "./cacheId";

describe("plugins/github/cacheId", () => {
  const sampleRepo = makeRepoId("foo", "bar");

  describe("CacheId type", () => {
    it("manually constructing a CacheId is illegal", () => {
      // $FlowExpectedError[incompatible-type]
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
    it("should have lowercase output", () => {
      const lowercaseId = cacheIdForRepoId(makeRepoId("foo", "bar"));
      const upperOwnerId = cacheIdForRepoId(makeRepoId("FOO", "bar"));
      const upperNameId = cacheIdForRepoId(makeRepoId("foo", "BAR"));
      expect(lowercaseId).not.toMatch(/[A-Z]/);
      expect(upperOwnerId).not.toMatch(/[A-Z]/);
      expect(upperNameId).not.toMatch(/[A-Z]/);
    });
    it("should deterministically match examples", () => {
      const expected = [
        {
          repoId: makeRepoId("sourcecred", "sourcecred"),
          cacheId: "github_sourcecred_sourcecred",
        },
        {
          repoId: makeRepoId("sourcecred", "sourcecred.github.io"),
          cacheId: "github_sourcecred_sourcecred.github.io",
        },
        {
          repoId: makeRepoId("foo", "Something-Good"),
          cacheId: "github_foo_something-good",
        },
        {
          repoId: makeRepoId("foo", "still_good"),
          cacheId: "github_foo_still_good",
        },
        {
          repoId: makeRepoId("fooolio", "foo-bar.bar-99_x"),
          cacheId: "github_fooolio_foo-bar.bar-99_x",
        },
        {
          repoId: makeRepoId("FOOolio", "foo-bar.bar-99_x"),
          cacheId: "github_fooolio_foo-bar.bar-99_x",
        },
      ];
      const output = expected.map(({repoId}) => ({
        repoId,
        cacheId: cacheIdForRepoId(repoId),
      }));
      expect(output).toEqual(expected);
    });
    it("should error if the owner name contains an undescore", () => {
      // GitHub doesn't allow such names because they're not valid DNS
      // labels. The `RepoId` type thus prevents constructing such
      // invalid instances; we fabricate one as a defensive check.
      const badRepoId: RepoId = ({owner: "h_mmm", name: "ok"}: any);
      expect(() => {
        cacheIdForRepoId(badRepoId);
      }).toThrow(/ambiguous/);
    });
  });
});
