// @flow

import {type EdgeAddressT, edgeToParts} from "../../core/graph";
import {createEdge, fromRaw, toRaw} from "./edges";
import * as GE from "./edges";
import * as GN from "./nodes";

describe("plugins/deprecated-git/edges", () => {
  const nodeExamples = {
    blob: (): GN.BlobAddress => ({
      type: GN.BLOB_TYPE,
      hash: "f1f2514ca6d7a6a1a0511957021b1995bf9ace1c",
    }),
    commit: (): GN.CommitAddress => ({
      type: GN.COMMIT_TYPE,
      hash: "3715ddfb8d4c4fd2a6f6af75488c82f84c92ec2f",
    }),
    parentCommit: (): GN.CommitAddress => ({
      type: GN.COMMIT_TYPE,
      hash: "69c5aad50eec8f2a0a07c988c3b283a6490eb45b",
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
    oldTreeEntry: (): GN.TreeEntryAddress => ({
      type: GN.TREE_ENTRY_TYPE,
      treeHash: "de07d6d2b2977734cf39d2b9aff4135eefce3eb7",
      name: "old_science.txt",
    }),
  };

  const edgeExamples = {
    hasTree: () =>
      createEdge.hasTree(nodeExamples.commit(), nodeExamples.tree()),
    hasParent: () =>
      createEdge.hasParent(nodeExamples.commit(), nodeExamples.parentCommit()),
    includes: () =>
      createEdge.includes(nodeExamples.tree(), nodeExamples.treeEntry()),
    becomes: () =>
      createEdge.becomes(nodeExamples.oldTreeEntry(), nodeExamples.treeEntry()),
    hasContents: () =>
      createEdge.hasContents(nodeExamples.treeEntry(), nodeExamples.blob()),
  };

  describe("createEdge", () => {
    Object.keys(edgeExamples).forEach((example) => {
      it(`works for ${JSON.stringify(example)}`, () => {
        const instance = edgeExamples[example]();
        expect(edgeToParts(instance)).toMatchSnapshot();
      });
    });
  });

  describe("`toRaw` after `fromRaw` is identity", () => {
    Object.keys(edgeExamples).forEach((example) => {
      it(example, () => {
        const baseAddress: EdgeAddressT = edgeExamples[example]().address;
        const instance: GE.RawAddress = (baseAddress: any);
        expect(toRaw(fromRaw(instance))).toEqual(instance);
      });
    });
  });

  describe("`fromRaw` after `toRaw` is identity", () => {
    Object.keys(edgeExamples).forEach((example) => {
      it(example, () => {
        const baseAddress: EdgeAddressT = edgeExamples[example]().address;
        const instance: GE.RawAddress = (baseAddress: any);
        const structured: GE.StructuredAddress = fromRaw(instance);
        expect(fromRaw(toRaw(structured))).toEqual(structured);
      });
    });
  });
});
