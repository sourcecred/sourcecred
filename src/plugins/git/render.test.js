// @flow

import {makeRepoId} from "../../core/repoId";
import * as GN from "./nodes";
import {description} from "./render";
import type {Repository} from "./types";

describe("plugins/git/render", () => {
  const exampleHash = "3715ddfb8d4c4fd2a6f6af75488c82f84c92ec2f";
  const exampleCommit: GN.CommitAddress = Object.freeze({
    type: GN.COMMIT_TYPE,
    hash: exampleHash,
  });
  const exampleRepository: Repository = Object.freeze({
    commits: {
      [exampleHash]: {
        hash: exampleHash,
        shortHash: exampleHash.slice(0, 7),
        summary: "This is an example commit",
        parentHashes: [],
      },
    },
    commitToRepoId: {
      [exampleHash]: {[(makeRepoId("sourcecred", "example-git"): any)]: true},
    },
  });

  it("commit snapshots as expected", () => {
    expect(description(exampleCommit, exampleRepository)).toMatchSnapshot();
  });
  it("logs an error for a commit not in the repository", () => {
    const badCommit = {type: GN.COMMIT_TYPE, hash: "1234"};
    // $ExpectFlowError
    console.error = jest.fn();
    expect(description(badCommit, exampleRepository)).toBe("1234");
    expect(console.error).toHaveBeenCalledWith(
      "Unable to find data for commit 1234"
    );
  });
});
