// @flow

import * as GN from "./nodes";
import {description} from "./render";

describe("plugins/deprecated-git/render", () => {
  const examples = {
    blob: (): GN.BlobAddress => ({
      type: GN.BLOB_TYPE,
      hash: "f1f2514ca6d7a6a1a0511957021b1995bf9ace1c",
    }),
    commit: (): GN.CommitAddress => ({
      type: GN.COMMIT_TYPE,
      hash: "3715ddfb8d4c4fd2a6f6af75488c82f84c92ec2f",
    }),
    tree: (): GN.TreeAddress => ({
      type: GN.TREE_TYPE,
      hash: "7be3ecfee5314ffa9b2d93fc4377792b2d6d70ed",
    }),
    treeEntry: (): GN.TreeEntryAddress => ({
      type: GN.TREE_ENTRY_TYPE,
      treeHash: "7be3ecfee5314ffa9b2d93fc4377792b2d6d70ed",
      name: "science.txt",
    }),
  };
  it("blob snapshots as expected", () => {
    expect(description(examples.blob())).toMatchSnapshot();
  });
  it("commit snapshots as expected", () => {
    expect(description(examples.commit())).toMatchSnapshot();
  });
  it("tree snapshots as expected", () => {
    expect(description(examples.tree())).toMatchSnapshot();
  });
  it("treeEntry snapshots as expected", () => {
    expect(description(examples.treeEntry())).toMatchSnapshot();
  });
});
