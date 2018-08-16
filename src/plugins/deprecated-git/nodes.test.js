// @flow

import {NodeAddress} from "../../core/graph";
import * as GN from "./nodes";
import {fromRaw, toRaw} from "./nodes";

describe("plugins/deprecated-git/nodes", () => {
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

  // Incorrect types should be caught statically, either due to being
  // totally invalid...
  // $ExpectFlowError
  const _unused_badTree: GN.RepoAddress = {
    type: "TREEEEE",
    hash: "browns",
  };
  // ...or due to being annotated with the type of a distinct structured
  // address:
  // $ExpectFlowError
  const _unused_badCommit: GN.CommitAddress = {...examples.tree()};

  describe("`fromRaw` after `toRaw` is identity", () => {
    Object.keys(examples).forEach((example) => {
      it(example, () => {
        const instance = examples[example]();
        expect(fromRaw(toRaw(instance))).toEqual(instance);
      });
    });
  });

  describe("`toRaw` after `fromRaw` is identity", () => {
    Object.keys(examples).forEach((example) => {
      it(example, () => {
        const instance = examples[example]();
        const raw = toRaw(instance);
        expect(toRaw(fromRaw(raw))).toEqual(raw);
      });
    });
  });

  describe("snapshots as expected:", () => {
    Object.keys(examples).forEach((example) => {
      it(example, () => {
        const instance = examples[example]();
        const raw = NodeAddress.toParts(toRaw(instance));
        expect({address: raw, structured: instance}).toMatchSnapshot();
      });
    });
  });

  describe("errors on", () => {
    describe("fromRaw(...) with", () => {
      function expectBadAddress(name: string, parts: $ReadOnlyArray<string>) {
        it(name, () => {
          const address = GN._gitAddress(...parts);
          expect(() => fromRaw(address)).toThrow("Bad address");
        });
      }
      it("undefined", () => {
        // $ExpectFlowError
        expect(() => fromRaw(undefined)).toThrow("undefined");
      });
      it("null", () => {
        // $ExpectFlowError
        expect(() => fromRaw(null)).toThrow("null");
      });
      it("bad prefix", () => {
        // $ExpectFlowError
        expect(() => fromRaw(NodeAddress.fromParts(["foo"]))).toThrow(
          "Bad address"
        );
      });

      expectBadAddress("no type", []);
      expectBadAddress("bad type", ["wat"]);

      expectBadAddress("blob with no hash", [GN.BLOB_TYPE]);
      expectBadAddress("blob with extra field", [
        GN.BLOB_TYPE,
        examples.blob().hash,
        examples.blob().hash,
      ]);

      expectBadAddress("commit with no hash", [GN.COMMIT_TYPE]);
      expectBadAddress("commit with extra field", [
        GN.COMMIT_TYPE,
        examples.commit().hash,
        examples.commit().hash,
      ]);

      expectBadAddress("tree with no hash", [GN.TREE_TYPE]);
      expectBadAddress("tree with extra field", [
        GN.TREE_TYPE,
        examples.tree().hash,
        examples.tree().hash,
      ]);

      expectBadAddress("tree entry with no fields", [GN.TREE_ENTRY_TYPE]);
      expectBadAddress("tree entry with only tree hash", [
        GN.TREE_ENTRY_TYPE,
        examples.treeEntry().treeHash,
      ]);
      expectBadAddress("tree entry with extra field", [
        GN.TREE_ENTRY_TYPE,
        examples.treeEntry().treeHash,
        examples.treeEntry().name,
        "wat",
      ]);
    });

    describe("toRaw(...) with", () => {
      it("null", () => {
        // $ExpectFlowError
        expect(() => toRaw(null)).toThrow("null");
      });
      it("undefined", () => {
        // $ExpectFlowError
        expect(() => toRaw(undefined)).toThrow("undefined");
      });
      it("bad type", () => {
        // $ExpectFlowError
        expect(() => toRaw({type: "ICE_CREAM"})).toThrow("Unexpected type");
      });
    });
  });
});
