// @flow

import deepFreeze from "deep-freeze";
import * as N from "./nodes";
import {shallow} from "enzyme";
import {description} from "./render";
import {type RepoId, repoIdToString, makeRepoId} from "../github/repoId";
import type {Repository, Hash, Commit} from "./types";
import type {GitGateway, URL} from "./gitGateway";
import Link from "../../webutil/Link";

require("../../webutil/testUtil").configureEnzyme();

describe("plugins/git/render", () => {
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
  const exampleRepository: Repository = deepFreeze({
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

  const exampleGitGateway: GitGateway = deepFreeze({
    commitUrl(repo: RepoId, hash: Hash): URL {
      return repoIdToString(repo) + "/" + hash;
    },
  });

  function renderExample(commit: Commit) {
    const commitAddress = {type: N.COMMIT_TYPE, hash: commit.hash};
    return shallow(
      description(commitAddress, exampleRepository, exampleGitGateway)
    );
  }

  it("handles a commit in exactly one repo", () => {
    const el = renderExample(singleRepoCommit);
    const link = el.find(Link);
    const expectedUrl = exampleGitGateway.commitUrl(
      repoId1,
      singleRepoCommit.hash
    );
    expect(link.props().href).toEqual(expectedUrl);
    expect(link.props().children).toEqual(singleRepoCommit.shortHash);
    expect(el.text()).toContain(singleRepoCommit.summary);
  });

  it("links to a single commit if it is in multiple repos", () => {
    const el = renderExample(twoRepoCommit);
    const link = el.find(Link);
    const expectedUrl = exampleGitGateway.commitUrl(
      repoId1,
      twoRepoCommit.hash
    );
    expect(link.props().href).toEqual(expectedUrl);
    expect(link.props().children).toEqual(twoRepoCommit.shortHash);
    expect(el.text()).toContain(twoRepoCommit.summary);
  });

  it("logs an error for a commit without any RepoIds", () => {
    // noRepoCommit: It has no entry in the repo tracker
    // zeroRepoCommit: it has an empty entry in the repo tracker
    // (behavior should be the same)
    for (const commit of [noRepoCommit, zeroRepoCommit]) {
      const el = renderExample(commit);

      expect(console.error).toHaveBeenCalledWith(
        `Unable to find repoIds for commit ${commit.hash}`
      );
      // $FlowExpectedError[cannot-write]
      console.error = jest.fn();

      expect(el.find(Link)).toHaveLength(0);
      expect(el.find("code").text()).toEqual(commit.shortHash);
      expect(el.text()).toContain(commit.summary);
    }
  });
  it("renders just the hash for a commit not in the repository", () => {
    // This can happen if, for instance, the GitHub plugin picks up a
    // commit object that was not known to the Git plugin. (Via, say, a
    // pull request that was merged but not into master, or a reference
    // to a commit in a different repository.)
    //
    const el = renderExample(unregisteredCommit);
    expect(el.find(Link)).toHaveLength(0);
    // Has the full hash, b.c. short hash couldn't be found
    expect(el.find("code").text()).toEqual(unregisteredCommit.hash);
    // No summary, as the data wasnt available
    expect(el.text()).not.toContain(unregisteredCommit.summary);
  });
});
