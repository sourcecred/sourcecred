// @flow

import cloneDeep from "lodash.clonedeep";

import {EdgeAddress, Graph, NodeAddress, edgeToString} from "../../core/graph";
import {createGraph} from "./createGraph";
import * as exampleRepo from "./example/exampleRepo";
import {GraphView} from "./graphView";
import type {Repository} from "./types";

import * as GE from "./edges";
import * as GN from "./nodes";

const makeData = (): Repository => cloneDeep(require("./example/example-git"));
const makeGraph = () => createGraph(makeData());
const makeView = () => new GraphView(makeGraph());

describe("plugins/git/graphView", () => {
  const view = makeView();
  function expectEqualMultisets(x: Iterable<mixed>, y: Iterable<mixed>) {
    const ax = Array.from(x);
    const ay = Array.from(y);
    expect(ax).toEqual(expect.arrayContaining(ay));
    expect(ay).toEqual(expect.arrayContaining(ax));
  }

  describe("GraphView", () => {
    it("#graph returns the provided graph", () => {
      const g1 = new Graph();
      const g2 = makeGraph();
      expect(new GraphView(g1).graph()).toBe(g1);
      expect(new GraphView(g2).graph()).toBe(g2);
    });

    it("#commits yields all commits", () => {
      const extraSubmoduleCommits = [
        exampleRepo.SUBMODULE_COMMIT_1,
        exampleRepo.SUBMODULE_COMMIT_2,
      ];
      const expectedHashes = Object.keys(makeData().commits).concat(
        extraSubmoduleCommits
      );
      const actualHashes = Array.from(view.commits()).map((a) => a.hash);
      expectEqualMultisets(actualHashes, expectedHashes);
    });

    it("#tree yields the correct tree for each commit", () => {
      const commits = makeData().commits;
      for (const commitHash of Object.keys(commits)) {
        const commit = commits[commitHash];
        const node: GN.CommitAddress = {type: GN.COMMIT_TYPE, hash: commitHash};
        expect(view.tree(node).hash).toEqual(commit.treeHash);
      }
    });

    it("#parents yields the correct parents for each commit", () => {
      const commits = makeData().commits;
      expect(Object.keys(commits)).not.toEqual([]);
      for (const commitHash of Object.keys(commits)) {
        const commit = commits[commitHash];
        const node: GN.CommitAddress = {type: GN.COMMIT_TYPE, hash: commitHash};
        const expectedParents = commit.parentHashes.slice();
        const actualParents = Array.from(view.parents(node)).map((a) => a.hash);
        expectEqualMultisets(actualParents, expectedParents);
      }
    });

    it("#entries yields the correct entries for each tree", () => {
      const trees = makeData().trees;
      expect(Object.keys(trees)).not.toEqual([]);
      for (const treeHash of Object.keys(trees)) {
        const tree = trees[treeHash];
        const node: GN.TreeAddress = {type: GN.TREE_TYPE, hash: treeHash};
        const actualEntries = Array.from(view.entries(node));
        const expectedEntries = Object.keys(tree.entries).map((name) => ({
          type: "TREE_ENTRY",
          treeHash,
          name,
        }));
        expectEqualMultisets(actualEntries, expectedEntries);
      }
    });

    describe("#contents yields the correct contents", () => {
      const entryByName = (name): GN.TreeEntryAddress => ({
        type: GN.TREE_ENTRY_TYPE,
        treeHash: "7be3ecfee5314ffa9b2d93fc4377792b2d6d70ed",
        name,
      });
      it("for blobs", () => {
        const actual = Array.from(view.contents(entryByName("science.txt")));
        const expected: $ReadOnlyArray<GN.BlobAddress> = [
          {
            type: GN.BLOB_TYPE,
            hash: "f1f2514ca6d7a6a1a0511957021b1995bf9ace1c",
          },
        ];
        expect(actual).toEqual(expected);
      });
      it("for trees", () => {
        const actual = Array.from(view.contents(entryByName("src")));
        const expected: $ReadOnlyArray<GN.TreeAddress> = [
          {
            type: GN.TREE_TYPE,
            hash: "78fc9c83023386854c6bfdc5761c0e58f68e226f",
          },
        ];
        expect(actual).toEqual(expected);
      });
      it("for submodule commits", () => {
        const actual = Array.from(
          view.contents(entryByName("pygravitydefier"))
        );
        const expected: $ReadOnlyArray<GN.CommitAddress> = [
          {
            type: GN.COMMIT_TYPE,
            hash: "29ef158bc982733e2ba429fcf73e2f7562244188",
          },
        ];
        expect(actual).toEqual(expected);
      });
    });

    it("#evolvesTo yields the correct entries", () => {
      const v0: GN.TreeEntryAddress = {
        type: GN.TREE_ENTRY_TYPE,
        treeHash: "569e1d383759903134df75230d63c0090196d4cb",
        name: "pygravitydefier",
      };
      const v1: GN.TreeEntryAddress = {
        type: GN.TREE_ENTRY_TYPE,
        treeHash: "819fc546cea489476ce8dc90785e9ba7753d0a8f",
        name: "pygravitydefier",
      };
      expect(Array.from(view.evolvesTo(v0))).toEqual([v1]);
    });

    it("#evolvesFrom yields the correct entries", () => {
      const v0: GN.TreeEntryAddress = {
        type: GN.TREE_ENTRY_TYPE,
        treeHash: "569e1d383759903134df75230d63c0090196d4cb",
        name: "pygravitydefier",
      };
      const v1: GN.TreeEntryAddress = {
        type: GN.TREE_ENTRY_TYPE,
        treeHash: "819fc546cea489476ce8dc90785e9ba7753d0a8f",
        name: "pygravitydefier",
      };
      expect(Array.from(view.evolvesFrom(v1))).toEqual([v0]);
    });

    describe("invariants", () => {
      it("check for malformed nodes", () => {
        const node = GN._gitAddress("wat");
        const g = new Graph().addNode(node);
        const expected = "Bad address: " + NodeAddress.toString(node);
        expect(() => new GraphView(g)).toThrow(expected);
      });
      it("check for malformed edges", () => {
        const c1: GN.CommitAddress = {type: GN.COMMIT_TYPE, hash: "c1"};
        const c2: GN.CommitAddress = {type: GN.COMMIT_TYPE, hash: "c2"};
        const edge = {
          address: EdgeAddress.append(GE._Prefix.base, "wat"),
          src: GN.toRaw(c1),
          dst: GN.toRaw(c2),
        };
        const g = new Graph()
          .addNode(GN.toRaw(c1))
          .addNode(GN.toRaw(c2))
          .addEdge(edge);
        const expected = "Bad address: " + EdgeAddress.toString(edge.address);
        expect(() => new GraphView(g)).toThrow(expected);
      });

      describe("check HAS_TREE edges", () => {
        const commit: GN.CommitAddress = {type: GN.COMMIT_TYPE, hash: "c1"};
        const otherCommit: GN.CommitAddress = {
          type: GN.COMMIT_TYPE,
          hash: "c2",
        };
        const tree: GN.TreeAddress = {type: GN.TREE_TYPE, hash: "t1"};
        const otherTree: GN.TreeAddress = {type: GN.TREE_TYPE, hash: "t2"};
        const edge = GE.createEdge.hasTree(commit, tree);
        const otherEdge = GE.createEdge.hasTree(otherCommit, otherTree);
        const foreignNode = NodeAddress.fromParts(["who", "are", "you"]);
        const baseGraph = () =>
          new Graph()
            .addNode(foreignNode)
            .addNode(GN.toRaw(commit))
            .addNode(GN.toRaw(tree))
            .addNode(GN.toRaw(otherTree));
        it("for proper src", () => {
          const badEdge = {...edge, src: foreignNode};
          const g = baseGraph().addEdge(badEdge);
          expect(() => new GraphView(g)).toThrow(
            "invariant violation: bad hom: " + edgeToString(badEdge)
          );
        });
        it("for proper dst", () => {
          const badEdge = {...edge, dst: foreignNode};
          const g = baseGraph().addEdge(badEdge);
          expect(() => new GraphView(g)).toThrow(
            "invariant violation: bad hom: " + edgeToString(badEdge)
          );
        });
        it("for correctness", () => {
          const badEdge = {...otherEdge, src: edge.src};
          const g = baseGraph().addEdge(badEdge);
          expect(() => new GraphView(g)).toThrow(
            "invariant violation: bad HAS_TREE edge: " + edgeToString(badEdge)
          );
        });
      });

      describe("check HAS_PARENT edges", () => {
        const c1: GN.CommitAddress = {type: GN.COMMIT_TYPE, hash: "c1"};
        const c2: GN.CommitAddress = {type: GN.COMMIT_TYPE, hash: "c2"};
        const c3: GN.CommitAddress = {type: GN.COMMIT_TYPE, hash: "c3"};
        const e2 = GE.createEdge.hasParent(c1, c2);
        const e3 = GE.createEdge.hasParent(c1, c3);
        const tree: GN.TreeAddress = {type: GN.TREE_TYPE, hash: "t1"};
        const foreignNode = NodeAddress.fromParts(["who", "are", "you"]);
        const baseGraph = () =>
          new Graph()
            .addNode(foreignNode)
            .addNode(GN.toRaw(c1))
            .addNode(GN.toRaw(c2))
            .addNode(GN.toRaw(c3))
            .addNode(GN.toRaw(tree))
            .addEdge(GE.createEdge.hasTree(c1, tree))
            .addEdge(GE.createEdge.hasTree(c2, tree))
            .addEdge(GE.createEdge.hasTree(c3, tree));
        it("for proper src", () => {
          const badEdge = {...e2, src: foreignNode};
          const g = baseGraph().addEdge(badEdge);
          expect(() => new GraphView(g)).toThrow(
            "invariant violation: bad hom: " + edgeToString(badEdge)
          );
        });
        it("for proper dst", () => {
          const badEdge = {...e2, dst: foreignNode};
          const g = baseGraph().addEdge(badEdge);
          expect(() => new GraphView(g)).toThrow(
            "invariant violation: bad hom: " + edgeToString(badEdge)
          );
        });
        it("for correctness", () => {
          const badEdge = {...e2, src: GN.toRaw(c2), dst: GN.toRaw(c3)};
          const g = baseGraph().addEdge(badEdge);
          expect(() => new GraphView(g)).toThrow(
            "invariant violation: bad HAS_PARENT edge: " + edgeToString(badEdge)
          );
        });
        it("allowing multiple parents", () => {
          const g = baseGraph()
            .addEdge(e2)
            .addEdge(e3);
          expect(() => new GraphView(g)).not.toThrow();
        });
      });

      describe("check INCLUDES edges", () => {
        const tree: GN.TreeAddress = {type: GN.TREE_TYPE, hash: "t1"};
        const entry: GN.TreeEntryAddress = {
          type: GN.TREE_ENTRY_TYPE,
          treeHash: tree.hash,
          name: "tree_entry.txt",
        };
        const anotherEntry: GN.TreeEntryAddress = {
          type: GN.TREE_ENTRY_TYPE,
          treeHash: tree.hash,
          name: "wat.txt",
        };
        const foreignNode = NodeAddress.fromParts(["who", "are", "you"]);
        const edge = GE.createEdge.includes(tree, entry);
        const baseGraph = () =>
          new Graph()
            .addNode(foreignNode)
            .addNode(GN.toRaw(tree))
            .addNode(GN.toRaw(entry));
        it("for proper src", () => {
          const badEdge = {...edge, src: foreignNode};
          const g = baseGraph().addEdge(badEdge);
          expect(() => new GraphView(g)).toThrow(
            "invariant violation: bad hom: " + edgeToString(badEdge)
          );
        });
        it("for proper dst", () => {
          const badEdge = {...edge, dst: foreignNode};
          const g = baseGraph().addEdge(badEdge);
          expect(() => new GraphView(g)).toThrow(
            "invariant violation: bad hom: " + edgeToString(badEdge)
          );
        });
        it("for existence", () => {
          const g = baseGraph();
          expect(() => new GraphView(g)).toThrow(
            "invariant violation: " +
              "tree entry should have 1 inclusion, but has 0: " +
              NodeAddress.toString(GN.toRaw(entry))
          );
        });
        it("for correctness", () => {
          const badEdge = {
            ...edge,
            address: GE.createEdge.includes(tree, anotherEntry).address,
          };
          const g = baseGraph().addEdge(badEdge);
          expect(() => new GraphView(g)).toThrow(
            "invariant violation: bad INCLUDES edge: " + edgeToString(badEdge)
          );
        });
      });

      describe("check BECOMES edges", () => {
        const t1: GN.TreeAddress = {type: GN.TREE_TYPE, hash: "t1"};
        const t2: GN.TreeAddress = {type: GN.TREE_TYPE, hash: "t1"};
        const te1: GN.TreeEntryAddress = {
          type: GN.TREE_ENTRY_TYPE,
          treeHash: "t1",
          name: "foo",
        };
        const te2: GN.TreeEntryAddress = {
          type: GN.TREE_ENTRY_TYPE,
          treeHash: "t2",
          name: "foo",
        };
        const te3: GN.TreeEntryAddress = {
          type: GN.TREE_ENTRY_TYPE,
          treeHash: "t2",
          name: "bar",
        };
        const e2 = GE.createEdge.becomes(te1, te2);
        const e3 = GE.createEdge.becomes(te1, te3);
        const foreignNode = NodeAddress.fromParts(["who", "are", "you"]);
        const baseGraph = () =>
          new Graph()
            .addNode(foreignNode)
            .addNode(GN.toRaw(t1))
            .addNode(GN.toRaw(t2))
            .addNode(GN.toRaw(te1))
            .addNode(GN.toRaw(te2))
            .addNode(GN.toRaw(te3))
            .addEdge(GE.createEdge.includes(t1, te1))
            .addEdge(GE.createEdge.includes(t2, te2))
            .addEdge(GE.createEdge.includes(t2, te3));
        it("for proper src", () => {
          const badEdge = {...e2, src: foreignNode};
          const g = baseGraph().addEdge(badEdge);
          expect(() => new GraphView(g)).toThrow(
            "invariant violation: bad hom: " + edgeToString(badEdge)
          );
        });
        it("for proper dst", () => {
          const badEdge = {...e2, dst: foreignNode};
          const g = baseGraph().addEdge(badEdge);
          expect(() => new GraphView(g)).toThrow(
            "invariant violation: bad hom: " + edgeToString(badEdge)
          );
        });
        it("for correctness", () => {
          const badEdge = {...e2, src: GN.toRaw(te2), dst: GN.toRaw(te3)};
          const g = baseGraph().addEdge(badEdge);
          expect(() => new GraphView(g)).toThrow(
            "invariant violation: bad BECOMES edge: " + edgeToString(badEdge)
          );
        });
        it("allowing multiple edges from a single source", () => {
          const g = baseGraph()
            .addEdge(e2)
            .addEdge(e3);
          expect(() => new GraphView(g)).not.toThrow();
        });
      });

      describe("checks HAS_CONTENTS edges", () => {
        const tree: GN.TreeAddress = {type: GN.TREE_TYPE, hash: "ceda12"};
        const te1: GN.TreeEntryAddress = {
          type: GN.TREE_ENTRY_TYPE,
          treeHash: "ceda12",
          name: "foo",
        };
        const te2: GN.TreeEntryAddress = {
          type: GN.TREE_ENTRY_TYPE,
          treeHash: "ceda12",
          name: "bar",
        };
        const blob: GN.BlobAddress = {type: GN.BLOB_TYPE, hash: "fish"};
        const e1 = GE.createEdge.hasContents(te1, blob);
        const foreignNode = NodeAddress.fromParts(["who", "are", "you"]);
        const baseGraph = () =>
          new Graph()
            .addNode(foreignNode)
            .addNode(GN.toRaw(tree))
            .addNode(GN.toRaw(te1))
            .addNode(GN.toRaw(te2))
            .addNode(GN.toRaw(blob))
            .addEdge(GE.createEdge.includes(tree, te1))
            .addEdge(GE.createEdge.includes(tree, te2));
        it("for proper src", () => {
          const badEdge = {...e1, src: foreignNode};
          const g = baseGraph().addEdge(badEdge);
          expect(() => new GraphView(g)).toThrow(
            "invariant violation: bad hom: " + edgeToString(badEdge)
          );
        });
        it("for proper dst", () => {
          const badEdge = {...e1, dst: foreignNode};
          const g = baseGraph().addEdge(badEdge);
          expect(() => new GraphView(g)).toThrow(
            "invariant violation: bad hom: " + edgeToString(badEdge)
          );
        });
        it("for correctness", () => {
          const badEdge = {...e1, src: GN.toRaw(te2)};
          const g = baseGraph().addEdge(badEdge);
          expect(() => new GraphView(g)).toThrow(
            "invariant violation: bad HAS_CONTENTS edge: " +
              edgeToString(badEdge)
          );
        });
      });
    });
  });
});
