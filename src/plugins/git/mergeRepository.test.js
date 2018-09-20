//@flow

import type {Repository} from "./types";
import {mergeRepository} from "./mergeRepository";

describe("plugins/git/mergeRepository", () => {
  describe("mergeRepository", () => {
    const empty: Repository = Object.freeze({commits: {}, trees: {}});
    const repository1: Repository = Object.freeze({
      commits: {
        commit1: {
          hash: "commit1",
          parentHashes: [],
          treeHash: "tree1",
        },
        commit2: {
          hash: "commit2",
          parentHashes: ["commit1"],
          treeHash: "tree2",
        },
      },
      trees: {
        tree1: {
          hash: "tree1",
          entries: {},
        },
        tree2: {
          hash: "tree2",
          entries: {},
        },
      },
    });
    const repository2: Repository = Object.freeze({
      commits: {
        commit1: {
          hash: "commit1",
          parentHashes: [],
          treeHash: "tree1",
        },
        commit3: {
          hash: "commit3",
          parentHashes: ["commit1"],
          treeHash: "tree3",
        },
      },
      trees: {
        tree1: {
          hash: "tree1",
          entries: {},
        },
        tree3: {
          hash: "tree3",
          entries: {},
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
    it("merged contains every hash and tree for every constituent repository", () => {
      const merged = mergeRepository([repository1, repository2]);
      for (const {trees, commits} of [repository1, repository2]) {
        for (const treeHash in trees) {
          expect(merged.trees[treeHash]).toEqual(trees[treeHash]);
        }
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
            parentHashes: [],
            treeHash: "tree2",
          },
        },
        trees: {
          tree2: {
            hash: "tree2",
            entries: {},
          },
        },
      });
      expect(() =>
        mergeRepository([repository1, conflictingRepository])
      ).toThrowError("Conflict between commits");
    });
    it("throws an error if merging a repository with conflicting trees", () => {
      const conflictingRepository: Repository = Object.freeze({
        commits: {
          commit1: {
            hash: "commit1",
            parentHashes: [],
            treeHash: "tree1",
          },
        },
        trees: {
          tree1: {
            hash: "tree1",
            entries: {blob: {type: "blob", name: "blob", hash: "blob"}},
          },
        },
      });
      expect(() =>
        mergeRepository([repository1, conflictingRepository])
      ).toThrowError("Conflict between trees");
    });
  });
});
