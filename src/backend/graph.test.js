// @flow

import type {Address, Addressable} from "./address";
import {sortedByAddress} from "./address";
import {Graph} from "./graph";
import * as demoData from "./graphDemoData";

describe("graph", () => {
  describe("#Graph", () => {
    // Some Graph functions return a set of results represented as an
    // array with undefined order. We canonicalize the ordering so that
    // we can then test equality with `expect(...).toEqual(...)`.
    function expectSameSorted<T: Addressable>(xs: T[], ys: T[]) {
      expect(sortedByAddress(xs)).toEqual(sortedByAddress(ys));
    }

    describe("construction", () => {
      it("works for a simple graph", () => {
        demoData.simpleMealGraph();
      });

      it("works for an advanced graph", () => {
        demoData.advancedMealGraph();
      });

      it("forbids adding an edge with dangling `dst`", () => {
        expect(() => {
          demoData.simpleMealGraph().addEdge({
            address: demoData.makeAddress(
              "treasure_octorok#5@helps_cook@seafood_fruit_mix#3"
            ),
            src: demoData.mealNode().address,
            dst: demoData.makeAddress("treasure_octorok#5"),
            payload: {},
          });
        }).toThrow(/does not exist/);
      });

      it("forbids adding an edge with dangling `src`", () => {
        expect(() => {
          demoData.simpleMealGraph().addEdge({
            address: demoData.makeAddress(
              "health_bar#6@healed_by@seafood_fruit_mix#3"
            ),
            src: demoData.makeAddress("health_bar#6"),
            dst: demoData.mealNode().address,
            payload: {},
          });
        }).toThrow(/does not exist/);
      });
    });

    describe("has nice error messages for", () => {
      [null, undefined].forEach((bad) => {
        // The following tests have `(bad: any)` because Flow
        // correctly detects that using `null` and `undefined` here is
        // bad. Thanks, Flow---but we want to simulate runtime
        // undefined-pollution, so we'll override you here.
        it(`adding ${String(bad)} nodes`, () => {
          expect(() => new Graph().addNode((bad: any))).toThrow(
            `node is ${String(bad)}`
          );
        });
        it(`adding ${String(bad)} edges`, () => {
          expect(() => new Graph().addEdge((bad: any))).toThrow(
            `edge is ${String(bad)}`
          );
        });
        it(`getting ${String(bad)} nodes`, () => {
          expect(() => new Graph().getNode((bad: any))).toThrow(
            `address is ${String(bad)}`
          );
        });
        it(`getting ${String(bad)} edges`, () => {
          expect(() => new Graph().getEdge((bad: any))).toThrow(
            `address is ${String(bad)}`
          );
        });
        it(`getting ${String(bad)} in-edges`, () => {
          expect(() => new Graph().getInEdges((bad: any))).toThrow(
            `address is ${String(bad)}`
          );
        });
        it(`getting ${String(bad)} out-edges`, () => {
          expect(() => new Graph().getOutEdges((bad: any))).toThrow(
            `address is ${String(bad)}`
          );
        });
      });
    });

    describe("getting nodes and edges", () => {
      it("correctly gets nodes in the simple graph", () => {
        const g = demoData.simpleMealGraph();
        [
          demoData.heroNode(),
          demoData.bananasNode(),
          demoData.crabNode(),
          demoData.mealNode(),
        ].forEach((x) => {
          expect(g.getNode(x.address)).toEqual(x);
        });
      });

      it("correctly gets nodes in the advanced graph", () => {
        const g = demoData.advancedMealGraph();
        [
          demoData.heroNode(),
          demoData.bananasNode(),
          demoData.crabNode(),
          demoData.mealNode(),
        ].forEach((x) => {
          expect(g.getNode(x.address)).toEqual(x);
        });
      });

      it("correctly gets edges in the simple graph", () => {
        const g = demoData.simpleMealGraph();
        [
          demoData.pickEdge(),
          demoData.grabEdge(),
          demoData.cookEdge(),
          demoData.bananasIngredientEdge(),
          demoData.crabIngredientEdge(),
          demoData.eatEdge(),
        ].forEach((x) => {
          expect(g.getEdge(x.address)).toEqual(x);
        });
      });

      it("correctly gets edges in the advanced graph", () => {
        const g = demoData.advancedMealGraph();
        [
          demoData.pickEdge(),
          demoData.grabEdge(),
          demoData.cookEdge(),
          demoData.bananasIngredientEdge(),
          demoData.crabIngredientEdge(),
          demoData.eatEdge(),
          demoData.crabLoopEdge(),
          demoData.duplicateCookEdge(),
        ].forEach((x) => {
          expect(g.getEdge(x.address)).toEqual(x);
        });
      });

      it("returns `undefined` for nodes that do not exist", () => {
        expect(
          demoData
            .simpleMealGraph()
            .getNode(demoData.makeAddress("treasure_octorok#5"))
        ).toBeUndefined();
      });

      it("returns `undefined` for edges that do not exist", () => {
        expect(
          demoData
            .simpleMealGraph()
            .getNode(
              demoData.makeAddress(
                "treasure_octorok#5@helps_cook@seafood_fruit_mix#3"
              )
            )
        ).toBeUndefined();
      });

      it("gets all nodes", () => {
        const expected = [
          demoData.heroNode(),
          demoData.bananasNode(),
          demoData.crabNode(),
          demoData.mealNode(),
        ];
        const actual = demoData.advancedMealGraph().getAllNodes();
        expectSameSorted(expected, actual);
      });

      it("gets all edges", () => {
        const expected = [
          demoData.pickEdge(),
          demoData.grabEdge(),
          demoData.cookEdge(),
          demoData.bananasIngredientEdge(),
          demoData.crabIngredientEdge(),
          demoData.eatEdge(),
          demoData.crabLoopEdge(),
          demoData.duplicateCookEdge(),
        ];
        const actual = demoData.advancedMealGraph().getAllEdges();
        expectSameSorted(expected, actual);
      });
    });

    describe("creating nodes and edges", () => {
      it("forbids adding a node with existing address", () => {
        expect(() =>
          demoData.simpleMealGraph().addNode({
            address: demoData.crabNode().address,
            payload: {anotherCrab: true},
          })
        ).toThrow(/already exists/);
      });

      it("forbids adding an edge with existing address", () => {
        expect(() =>
          demoData.simpleMealGraph().addEdge({
            address: demoData.cookEdge().address,
            src: demoData.crabNode().address,
            dst: demoData.crabNode().address,
            payload: {},
          })
        ).toThrow(/already exists/);
      });

      it("allows creating self-loops", () => {
        const g = demoData.simpleMealGraph();
        g.addEdge(demoData.crabLoopEdge());
        expect(g.getOutEdges(demoData.crabNode().address)).toContainEqual(
          demoData.crabLoopEdge()
        );
        expect(g.getInEdges(demoData.crabNode().address)).toContainEqual(
          demoData.crabLoopEdge()
        );
      });

      it("allows creating multiple edges between the same nodes", () => {
        const g = demoData.simpleMealGraph();
        g.addEdge(demoData.duplicateCookEdge());
        [demoData.cookEdge(), demoData.duplicateCookEdge()].forEach((e) => {
          expect(g.getOutEdges(demoData.mealNode().address)).toContainEqual(e);
          expect(g.getEdge(e.address)).toEqual(e);
        });
      });

      // For the next two test cases: we're documenting this behavior,
      // though we're not sure if it's the right behavior. Perhaps we want
      // the namespaces to be forced to be disjoint. In that case, we can
      // certainly change these tests.
      it("allows adding an edge with an existing node's address", () => {
        demoData.simpleMealGraph().addEdge({
          address: demoData.crabNode().address,
          src: demoData.crabNode().address,
          dst: demoData.crabNode().address,
          payload: {message: "thanks for being you"},
        });
      });
      it("allows adding a node with an existing edge's address", () => {
        demoData.simpleMealGraph().addNode({
          address: demoData.cookEdge().address,
          payload: {},
        });
      });
    });

    describe("in- and out-edges", () => {
      it("gets out-edges", () => {
        const nodeAndExpectedEdgePairs = [
          [demoData.heroNode(), [demoData.eatEdge()]],
          [demoData.bananasNode(), [demoData.pickEdge()]],
          [demoData.crabNode(), [demoData.grabEdge(), demoData.crabLoopEdge()]],
          [
            demoData.mealNode(),
            [
              demoData.bananasIngredientEdge(),
              demoData.crabIngredientEdge(),
              demoData.cookEdge(),
              demoData.duplicateCookEdge(),
            ],
          ],
        ];
        nodeAndExpectedEdgePairs.forEach(([node, expectedEdges]) => {
          const actual = demoData.advancedMealGraph().getOutEdges(node.address);
          expectSameSorted(actual, expectedEdges);
        });
      });

      it("gets in-edges", () => {
        const nodeAndExpectedEdgePairs = [
          [
            demoData.heroNode(),
            [
              demoData.pickEdge(),
              demoData.grabEdge(),
              demoData.cookEdge(),
              demoData.duplicateCookEdge(),
            ],
          ],
          [demoData.bananasNode(), [demoData.bananasIngredientEdge()]],
          [
            demoData.crabNode(),
            [demoData.crabIngredientEdge(), demoData.crabLoopEdge()],
          ],
          [demoData.mealNode(), [demoData.eatEdge()]],
        ];
        nodeAndExpectedEdgePairs.forEach(([node, expectedEdges]) => {
          const actual = demoData.advancedMealGraph().getInEdges(node.address);
          expectSameSorted(actual, expectedEdges);
        });
      });

      it("fails to get out-edges for a nonexistent node", () => {
        expect(() => {
          demoData.simpleMealGraph().getOutEdges(demoData.makeAddress("hinox"));
        }).toThrow(/no node for address/);
      });

      it("fails to get in-edges for a nonexistent node", () => {
        expect(() => {
          demoData.simpleMealGraph().getInEdges(demoData.makeAddress("hinox"));
        }).toThrow(/no node for address/);
      });
    });

    describe("#equals", () => {
      it("returns true for identity-equal graphs", () => {
        const g = demoData.advancedMealGraph();
        expect(g.equals(g)).toBe(true);
      });
      it("returns true for deep-equal graphs", () => {
        expect(
          demoData.advancedMealGraph().equals(demoData.advancedMealGraph())
        ).toBe(true);
      });
      it("returns false when the LHS has nodes missing in the RHS", () => {
        expect(
          demoData.advancedMealGraph().equals(demoData.simpleMealGraph())
        ).toBe(false);
      });
      it("returns false when the RHS has nodes missing in the LHS", () => {
        expect(
          demoData.simpleMealGraph().equals(demoData.advancedMealGraph())
        ).toBe(false);
      });
      const extraNode1 = () => ({
        address: demoData.makeAddress("octorok"),
        payload: {},
      });
      const extraNode2 = () => ({
        address: demoData.makeAddress("hinox"),
        payload: {status: "sleeping"},
      });
      it("returns false when the LHS has edges missing in the RHS", () => {
        const g1 = demoData.advancedMealGraph();
        const g2 = demoData.advancedMealGraph().addNode(extraNode1());
        expect(g1.equals(g2)).toBe(false);
      });
      it("returns false when the LHS has edges missing in the RHS", () => {
        const g1 = demoData.advancedMealGraph().addNode(extraNode1());
        const g2 = demoData.advancedMealGraph();
        expect(g1.equals(g2)).toBe(false);
      });
      it("returns true when nodes are added in different orders", () => {
        const g1 = new Graph().addNode(extraNode1()).addNode(extraNode2());
        const g2 = new Graph().addNode(extraNode2()).addNode(extraNode1());
        expect(g1.equals(g2)).toBe(true);
        expect(g2.equals(g1)).toBe(true);
      });
    });

    describe("merging", () => {
      /**
       * Decompose the given graph into neighborhood graphs: for each
       * node `u`, create a graph with just that node, its neighbors,
       * and its incident edges (in both directions).
       */
      function neighborhoodDecomposition(originalGraph: Graph): Graph[] {
        return originalGraph.getAllNodes().map((node) => {
          const miniGraph = new Graph();
          miniGraph.addNode(node);
          originalGraph.getOutEdges(node.address).forEach((edge) => {
            if (miniGraph.getNode(edge.dst) === undefined) {
              miniGraph.addNode(originalGraph.getNode(edge.dst));
            }
            miniGraph.addEdge(edge);
          });
          originalGraph.getInEdges(node.address).forEach((edge) => {
            if (miniGraph.getNode(edge.src) === undefined) {
              miniGraph.addNode(originalGraph.getNode(edge.src));
            }
            if (miniGraph.getEdge(edge.address) === undefined) {
              // This check is necessary to prevent double-adding loops.
              miniGraph.addEdge(edge);
            }
          });
          return miniGraph;
        });
      }

      /**
       * Decompose the given graph into edge graphs: for each edge `e`,
       * create a graph with just that edge and its two endpoints.
       */
      function edgeDecomposition(originalGraph: Graph): Graph[] {
        return originalGraph.getAllEdges().map((edge) => {
          const miniGraph = new Graph();
          miniGraph.addNode(originalGraph.getNode(edge.src));
          if (miniGraph.getNode(edge.dst) === undefined) {
            // This check is necessary to prevent double-adding loops.
            miniGraph.addNode(originalGraph.getNode(edge.dst));
          }
          miniGraph.addEdge(edge);
          return miniGraph;
        });
      }

      it("conservatively recomposes a neighborhood decomposition", () => {
        const result = neighborhoodDecomposition(
          demoData.advancedMealGraph()
        ).reduce((g1, g2) => Graph.mergeConservative(g1, g2), new Graph());
        expect(result.equals(demoData.advancedMealGraph())).toBe(true);
      });

      it("conservatively recomposes an edge decomposition", () => {
        const result = edgeDecomposition(demoData.advancedMealGraph()).reduce(
          (g1, g2) => Graph.mergeConservative(g1, g2),
          new Graph()
        );
        expect(result.equals(demoData.advancedMealGraph())).toBe(true);
      });

      it("conservatively merges a graph with itself", () => {
        const result = Graph.mergeConservative(
          demoData.advancedMealGraph(),
          demoData.advancedMealGraph()
        );
        expect(result.equals(demoData.advancedMealGraph())).toBe(true);
      });

      it("conservatively rejects a graph with conflicting nodes", () => {
        const makeGraph: (nodePayload: string) => Graph = (nodePayload) =>
          new Graph().addNode({
            address: demoData.makeAddress("conflicting-node"),
            payload: nodePayload,
          });
        const g1 = makeGraph("one");
        const g2 = makeGraph("two");
        expect(() => {
          Graph.mergeConservative(g1, g2);
        }).toThrow(/distinct nodes with address/);
      });

      it("conservatively rejects a graph with conflicting edges", () => {
        const srcAddress = demoData.makeAddress("src");
        const dstAddress = demoData.makeAddress("dst");
        const makeGraph: (edgePayload: string) => Graph = (edgePayload) =>
          new Graph()
            .addNode({address: srcAddress, payload: {}})
            .addNode({address: dstAddress, payload: {}})
            .addEdge({
              address: demoData.makeAddress("conflicting-edge"),
              src: srcAddress,
              dst: dstAddress,
              payload: edgePayload,
            });
        const g1 = makeGraph("one");
        const g2 = makeGraph("two");
        expect(() => {
          Graph.mergeConservative(g1, g2);
        }).toThrow(/distinct edges with address/);
      });

      function assertNotCalled(...args) {
        throw new Error(`called with: ${args.join()}`);
      }
      it("has the empty graph as a left identity", () => {
        const merged = Graph.merge(
          new Graph(),
          demoData.advancedMealGraph(),
          assertNotCalled,
          assertNotCalled
        );
        expect(merged.equals(demoData.advancedMealGraph())).toBe(true);
      });
      it("has the empty graph as a right identity", () => {
        const merged = Graph.merge(
          demoData.advancedMealGraph(),
          new Graph(),
          assertNotCalled,
          assertNotCalled
        );
        expect(merged.equals(demoData.advancedMealGraph())).toBe(true);
      });
      it("trivially merges the empty graph with itself", () => {
        const merged = Graph.merge(
          new Graph(),
          new Graph(),
          assertNotCalled,
          assertNotCalled
        );
        expect(merged.equals(new Graph())).toBe(true);
      });
    });

    describe("JSON functions", () => {
      it("should serialize a simple graph", () => {
        expect(demoData.advancedMealGraph().toJSON()).toMatchSnapshot();
      });
      it("should work transparently with JSON.stringify", () => {
        // (This is guaranteed by the `JSON.stringify` API, and is more
        // as documentation than actual test.)
        expect(JSON.stringify(demoData.advancedMealGraph())).toEqual(
          JSON.stringify(demoData.advancedMealGraph().toJSON())
        );
      });
      it("should canonicalize away node insertion order", () => {
        const g1 = new Graph()
          .addNode(demoData.heroNode())
          .addNode(demoData.mealNode());
        const g2 = new Graph()
          .addNode(demoData.mealNode())
          .addNode(demoData.heroNode());
        expect(g1.toJSON()).toEqual(g2.toJSON());
      });
      it("should canonicalize away edge insertion order", () => {
        const g1 = new Graph()
          .addNode(demoData.heroNode())
          .addNode(demoData.mealNode())
          .addEdge(demoData.cookEdge())
          .addEdge(demoData.duplicateCookEdge());
        const g2 = new Graph()
          .addNode(demoData.heroNode())
          .addNode(demoData.mealNode())
          .addEdge(demoData.duplicateCookEdge())
          .addEdge(demoData.cookEdge());
        expect(g1.toJSON()).toEqual(g2.toJSON());
      });
      it("should no-op on a serialization--deserialization roundtrip", () => {
        const g = () => demoData.advancedMealGraph();
        expect(Graph.fromJSON(g().toJSON()).equals(g())).toBe(true);
      });
      it("should no-op on a deserialization--serialization roundtrip", () => {
        const json = () => demoData.advancedMealGraph().toJSON();
        expect(Graph.fromJSON(json()).toJSON()).toEqual(json());
      });
    });
  });
});
