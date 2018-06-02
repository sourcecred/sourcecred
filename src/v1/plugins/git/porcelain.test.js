// @flow

import cloneDeep from "lodash.clonedeep";
import {
  COMMIT_NODE_TYPE,
  TREE_NODE_TYPE,
  SUBMODULE_COMMIT_NODE_TYPE,
  BLOB_NODE_TYPE,
} from "./types";
import {
  GraphPorcelain,
  BlobReference,
  TreeReference,
  BlobPorcelain,
  TreePorcelain,
  TreeEntryReference,
  TreeEntryPorcelain,
  SubmoduleCommitPorcelain,
  SubmoduleCommitReference,
  CommitReference,
  CommitPorcelain,
} from "./porcelain";
import {createGraph} from "./createGraph";

const makeGraphPorcelain = () =>
  new GraphPorcelain(createGraph(cloneDeep(require("./demoData/example-git"))));

const getCommit = () => {
  const graph = makeGraphPorcelain();
  const commitHash = "3715ddfb8d4c4fd2a6f6af75488c82f84c92ec2f";
  const commit = graph.commitByHash(commitHash);
  if (commit.hash() !== commitHash) {
    throw new Error(
      `Expected commit hash ${commitHash}, got hash ${commit.hash()}`
    );
  }
  return commit;
};

function really<T>(x: ?T): T {
  if (x == null) {
    throw new Error(`It wasn't, really`);
  }
  return x;
}

const getTree = () => {
  return getCommit().tree();
};

const getTreeEntry = (name: string) => {
  return really(getTree().entry(name));
};

const getBlob = () => {
  return really(getTreeEntry("science.txt").blob());
};

const getSubmoduleCommit = () => {
  return getTreeEntry("pygravitydefier").submoduleCommits()[0];
};

describe("Git porcelain", () => {
  it("commits have hashes", () => {
    const commit = getCommit();
    const commitHash = "3715ddfb8d4c4fd2a6f6af75488c82f84c92ec2f";
    expect(commit.hash()).toEqual(commitHash);
  });

  it("some commits have parents", () => {
    const parentHash = "69c5aad50eec8f2a0a07c988c3b283a6490eb45b";
    const parents = getCommit().parents();
    expect(parents).toHaveLength(1);
    expect(parents[0].hash()).toEqual(parentHash);
  });

  it("some commits have no parents", () => {
    const commitHash = "c2b51945e7457546912a8ce158ed9d294558d294";
    const commit = makeGraphPorcelain().commitByHash(commitHash);
    expect(commit.parents()).toEqual([]);
  });

  it("Commits have a unique, hash-identified tree", () => {
    const tree = getTree();
    expect(tree.hash()).toEqual("7be3ecfee5314ffa9b2d93fc4377792b2d6d70ed");
  });

  it("Trees have tree entries", () => {
    const entries = getTree().entries();
    expect(entries).toHaveLength(5);
    const entryNames = entries.map((x) => x.name());
    expect(entryNames).toEqual(
      expect.arrayContaining([
        "pygravitydefier",
        "src",
        ".gitmodules",
        "README.txt",
        "science.txt",
      ])
    );
  });
  it("Tree entries can have blobs", () => {
    const blob = getBlob();
    expect(blob.hash()).toEqual("f1f2514ca6d7a6a1a0511957021b1995bf9ace1c");
  });

  it("Tree entries can have trees", () => {
    const treeEntry = getTreeEntry("src");
    const tree = really(treeEntry.tree());
    expect(tree.hash()).toEqual("78fc9c83023386854c6bfdc5761c0e58f68e226f");
  });

  it("Tree entries can have submodule commits", () => {
    const sc = really(getSubmoduleCommit().get());
    expect(sc.hash()).toEqual("29ef158bc982733e2ba429fcf73e2f7562244188");
    expect(sc.url()).toEqual(
      "https://github.com/sourcecred/example-git-submodule.git"
    );
  });

  it("Tree entries can evolve to/from other tree entries", () => {
    const parentCommitHash = "e8b7a8f19701cd5a25e4a097d513ead60e5f8bcc";
    const childCommitHash = "69c5aad50eec8f2a0a07c988c3b283a6490eb45b";
    const graph = makeGraphPorcelain();
    const parentEntry = graph
      .commitByHash(parentCommitHash)
      .tree()
      .entry("src");
    const childEntry = graph
      .commitByHash(childCommitHash)
      .tree()
      .entry("src");
    if (parentEntry == null || childEntry == null) {
      throw new Error("Couldn't get expected entries");
    }
    expect(parentEntry.evolvesTo()).toEqual([childEntry]);
    expect(childEntry.evolvesFrom()).toEqual([parentEntry]);
  });

  describe("flow and runtime type verification", () => {
    it("for Commit", () => {
      const c: CommitReference = getCommit();
      const p: CommitPorcelain = really(c.get());
      const _: CommitReference = p.ref();
      const err = `to have type ${COMMIT_NODE_TYPE}`;
      expect(() => new CommitReference(getTree())).toThrow(err);
      expect(() => new CommitPorcelain(really(getTree().get()))).toThrow(err);
    });
    it("for Tree", () => {
      const c: TreeReference = getTree();
      const p: TreePorcelain = really(c.get());
      const _: TreeReference = p.ref();
      const err = `to have type ${TREE_NODE_TYPE}`;
      expect(() => new TreeReference(getCommit())).toThrow(err);
      expect(() => new TreePorcelain(really(getCommit().get()))).toThrow(err);
    });
    it("for TreeEntry", () => {
      const c: TreeEntryReference = getTreeEntry("src");
      const p: TreeEntryPorcelain = really(c.get());
      const _: TreeEntryReference = p.ref();
      const err = `to have type ${TREE_NODE_TYPE}`;
      expect(() => new TreeEntryReference(getCommit())).toThrow(err);
      expect(() => new TreeEntryPorcelain(really(getTree().get()))).toThrow(
        err
      );
    });
    it("for Blob", () => {
      const c: BlobReference = getBlob();
      const p: BlobPorcelain = really(c.get());
      const _: BlobReference = p.ref();
      const err = `to have type ${BLOB_NODE_TYPE}`;
      expect(() => new BlobReference(getCommit())).toThrow(err);
      expect(() => new BlobPorcelain(really(getTree().get()))).toThrow(err);
    });
    it("for SubmoduleCommit", () => {
      const c: SubmoduleCommitReference = getSubmoduleCommit();
      const p: SubmoduleCommitPorcelain = really(c.get());
      const _: SubmoduleCommitReference = p.ref();
      const err = `to have type ${SUBMODULE_COMMIT_NODE_TYPE}`;
      expect(() => new SubmoduleCommitReference(getCommit())).toThrow(err);
      expect(
        () => new SubmoduleCommitPorcelain(really(getTree().get()))
      ).toThrow(err);
    });
  });
});
