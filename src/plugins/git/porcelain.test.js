// @flow

import cloneDeep from "lodash.clonedeep";
import {PorcelainGraph, Blob, Tree, SubmoduleCommit} from "./porcelain";
import {createGraph} from "./createGraph";

const makePorcelainGraph = () =>
  new PorcelainGraph(createGraph(cloneDeep(require("./demoData/example-git"))));

const getCommit = () => {
  const graph = makePorcelainGraph();
  const commitHash = "3715ddfb8d4c4fd2a6f6af75488c82f84c92ec2f";
  const commit = graph.commitByHash(commitHash);
  if (commit.hash() !== commitHash) {
    throw new Error(
      `Expected commit hash ${commitHash}, got hash ${commit.hash()}`
    );
  }
  return commit;
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
    const commit = makePorcelainGraph().commitByHash(commitHash);
    expect(commit.parents()).toEqual([]);
  });

  it("Commits have a unique, hash-identified tree", () => {
    const tree = getCommit().tree();
    expect(tree.hash()).toEqual("7be3ecfee5314ffa9b2d93fc4377792b2d6d70ed");
  });

  it("Trees have tree entries", () => {
    const tree = getCommit().tree();
    const entries = tree.entries();
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
    const entry = getCommit()
      .tree()
      .entry("science.txt");
    if (entry == null) {
      throw new Error("Where is science?!");
    }
    const blob: Blob = Blob.from(entry.contents()[0]);
    expect(blob.hash()).toEqual("f1f2514ca6d7a6a1a0511957021b1995bf9ace1c");
  });

  it("Tree entries can have trees", () => {
    const entry = getCommit()
      .tree()
      .entry("src");
    if (entry == null) {
      throw new Error("Where is src?!");
    }
    const tree: Tree = Tree.from(entry.contents()[0]);
    expect(tree.hash()).toEqual("78fc9c83023386854c6bfdc5761c0e58f68e226f");
  });

  it("Tree entries can have submodule commits", () => {
    const entry = getCommit()
      .tree()
      .entry("pygravitydefier");
    if (entry == null) {
      throw new Error("We've stopped defying gravity :(");
    }
    const sc: SubmoduleCommit = SubmoduleCommit.from(entry.contents()[0]);
    expect(sc.hash()).toEqual("29ef158bc982733e2ba429fcf73e2f7562244188");
    expect(sc.url()).toEqual(
      "https://github.com/sourcecred/example-git-submodule.git"
    );
  });

  it("Tree entries can evolve to/from other tree entries", () => {
    const parentCommitHash = "e8b7a8f19701cd5a25e4a097d513ead60e5f8bcc";
    const childCommitHash = "69c5aad50eec8f2a0a07c988c3b283a6490eb45b";
    const graph = makePorcelainGraph();
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
});
