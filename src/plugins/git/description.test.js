// @flow

import * as N from "./nodes";
import {description} from "./description";
import {type RepoId, repoIdToString, makeRepoId} from "../../core/repoId";
import type {Repository, Hash, Commit} from "./types";
import type {GitGateway, URL} from "./gitGateway";

describe("plugins/git/description", () => {
  const repoId1 = makeRepoId("example-owner", "1");
  const repoId2 = makeRepoId("example-owner", "2");
  const singleRepoCommit = {
    hash: "singleRepoCommit",
    shortHash: "singleRepo",
    summary: "A simple example commit",
    createdAt: 123456789,
    parentHashes: [],
  };
  const twoRepoCommit = {
    hash: "twoRepoCommit",
    shortHash: "twoRepo",
    summary: "Two repos claim dominion over this commit",
    createdAt: 123456789,
    parentHashes: [],
  };
  const noRepoCommit = {
    hash: "noRepoCommit",
    shortHash: "noRepo",
    summary: "commitToRepoId has no memory of this commit ",
    createdAt: 123456789,
    parentHashes: [],
  };
  const zeroRepoCommit = {
    hash: "zeroRepoCommit",
    shortHash: "zeroRepo",
    summary: "This commit has exactly zero repoIds matching",
    createdAt: 123456789,
    parentHashes: [],
  };
  const unregisteredCommit = {
    hash: "unregisteredCommit",
    shortHash: "unregistered",
    summary: "This commit isn't in the Repository",
    createdAt: 123456789,
    parentHashes: [],
  };
  const exampleRepository: Repository = Object.freeze({
    commits: {
      zeroRepoCommit,
      singleRepoCommit,
      twoRepoCommit,
      noRepoCommit,
    },
    commitToRepoId: {
      zeroRepoCommit: {},
      singleRepoCommit: {[(repoIdToString(repoId1): any)]: true},
      twoRepoCommit: {
        [(repoIdToString(repoId1): any)]: true,
        [(repoIdToString(repoId2): any)]: true,
      },
    },
  });

  const exampleGitGateway: GitGateway = Object.freeze({
    commitUrl(repo: RepoId, hash: Hash): URL {
      return repoIdToString(repo) + "/" + hash;
    },
  });

  function descr(commit: Commit) {
    const commitAddress = {type: N.COMMIT_TYPE, hash: commit.hash};
    return description(commitAddress, exampleRepository, exampleGitGateway);
  }

  it("single-repo commit: shows a shorthash with url", () => {
    expect(descr(singleRepoCommit)).toMatchInlineSnapshot(
      `"[singleRepo](example-owner/1/singleRepoCommit): A simple example commit"`
    );
  });

  it("multi-repo commit: shows a shorthash with a single url", () => {
    expect(descr(singleRepoCommit)).toMatchInlineSnapshot(
      `"[singleRepo](example-owner/1/singleRepoCommit): A simple example commit"`
    );
  });

  it("logs an error for a commit without any RepoIds", () => {
    // $ExpectFlowError
    console.error = jest.fn();
    // noRepoCommit: It has no entry in the repo tracker
    // zeroRepoCommit: it has an empty entry in the repo tracker
    // (behavior should be the same)
    const results = {};
    for (const commit of [noRepoCommit, zeroRepoCommit]) {
      const d = descr(commit);
      results[commit.hash] = d;

      expect(console.error).toHaveBeenCalledWith(
        `Unable to find repoIds for commit ${commit.hash}`
      );
    }
    expect(results).toMatchInlineSnapshot(`
Object {
  "noRepoCommit": "noRepo: commitToRepoId has no memory of this commit ",
  "zeroRepoCommit": "zeroRepo: This commit has exactly zero repoIds matching",
}
`);
  });
  it("renders just the hash for a commit not in the repository", () => {
    // This can happen if, for instance, the GitHub plugin picks up a
    // commit object that was not known to the Git plugin. (Via, say, a
    // pull request that was merged but not into master, or a reference
    // to a commit in a different repository.)
    //
    const d = descr(unregisteredCommit);
    expect(d).toMatchInlineSnapshot(`"unregisteredCommit"`);
  });
});
