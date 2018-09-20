//@flow

import type {Repository} from "./types";
import {mergeRepository} from "./mergeRepository";

describe("plugins/git/mergeRepository", () => {
  describe("mergeRepository", () => {
    const empty: Repository = Object.freeze({commits: {}});
    const repository1: Repository = Object.freeze({
      commits: {
        commit1: {
          hash: "commit1",
          shortHash: "commit1",
          summary: "a commit",
          parentHashes: [],
        },
        commit2: {
          hash: "commit2",
          shortHash: "commit2",
          summary: "another commit",
          parentHashes: ["commit1"],
        },
      },
    });
    const repository2: Repository = Object.freeze({
      commits: {
        commit1: {
          hash: "commit1",
          shortHash: "commit1",
          summary: "a commit",
          parentHashes: [],
        },
        commit3: {
          hash: "commit3",
          shortHash: "commit3",
          summary: "a third commit",
          parentHashes: ["commit1"],
        },
      },
    });

    it("returns empty repository with no arguments", () => {
      expect(mergeRepository([])).toEqual(empty);
    });
    it("returns copy of the input repository when n=1", () => {
      const merged = mergeRepository([repository1]);
      expect(merged).toEqual(repository1);
      expect(merged).not.toBe(repository1);
    });
    it("treats empty repository as identity", () => {
      const merged = mergeRepository([empty, repository1, empty]);
      expect(merged).toEqual(repository1);
    });
    it("merged contains every commit for every constituent repository", () => {
      const merged = mergeRepository([repository1, repository2]);
      for (const {commits} of [repository1, repository2]) {
        for (const commitHash in commits) {
          expect(merged.commits[commitHash]).toEqual(commits[commitHash]);
        }
      }
    });
    it("throws an error if merging a repository with conflicting commits", () => {
      const conflictingRepository: Repository = Object.freeze({
        commits: {
          commit1: {
            hash: "commit1",
            shortHash: "commit1",
            summary: "a conflicting commit",
            parentHashes: ["commit0"],
          },
        },
      });
      expect(() =>
        mergeRepository([repository1, conflictingRepository])
      ).toThrowError("Conflict between commits");
    });
  });
});
