// @flow

import cloneDeep from "lodash.clonedeep";

import {EdgeAddress, Graph, NodeAddress, edgeToString} from "../../core/graph";
import {createGraph} from "./createGraph";
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
      const expectedHashes = Object.keys(makeData().commits);
      const actualHashes = Array.from(view.commits()).map((a) => a.hash);
      expectEqualMultisets(actualHashes, expectedHashes);
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
          address: EdgeAddress.append(GE.Prefix.base, "wat"),
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

      describe("check HAS_PARENT edges", () => {
        const c1: GN.CommitAddress = {type: GN.COMMIT_TYPE, hash: "c1"};
        const c2: GN.CommitAddress = {type: GN.COMMIT_TYPE, hash: "c2"};
        const c3: GN.CommitAddress = {type: GN.COMMIT_TYPE, hash: "c3"};
        const e2 = GE.createEdge.hasParent(c1, c2);
        const e3 = GE.createEdge.hasParent(c1, c3);
        const foreignNode = NodeAddress.fromParts(["who", "are", "you"]);
        const baseGraph = () =>
          new Graph()
            .addNode(foreignNode)
            .addNode(GN.toRaw(c1))
            .addNode(GN.toRaw(c2))
            .addNode(GN.toRaw(c3));
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
    });
  });
});
