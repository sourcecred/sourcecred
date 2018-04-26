// @flow

import type {Address, Addressable} from "./address";
import {sortedByAddress} from "./address";
import type {Node, Edge} from "./graph";
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
        it(`removing ${String(bad)} nodes`, () => {
          expect(() => new Graph().removeNode((bad: any))).toThrow(
            `address is ${String(bad)}`
          );
        });
        it(`removing ${String(bad)} edges`, () => {
          expect(() => new Graph().removeEdge((bad: any))).toThrow(
            `address is ${String(bad)}`
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
            .getNode(demoData.makeAddress("treasure_octorok#5", "NPC"))
        ).toBeUndefined();
      });

      it("returns `undefined` for edges that do not exist", () => {
        expect(
          demoData
            .simpleMealGraph()
            .getNode(
              demoData.makeAddress(
                "treasure_octorok#5@helps_cook@seafood_fruit_mix#3",
                "ACTION"
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
        const actual = demoData.advancedMealGraph().getNodes();
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
        const actual = demoData.advancedMealGraph().getEdges();
        expectSameSorted(expected, actual);
      });
    });

    describe("creating nodes and edges", () => {
      it("allows adding an edge with dangling `dst`", () => {
        const edge = () => ({
          address: demoData.makeAddress(
            "treasure_octorok#5@helps_cook@seafood_fruit_mix#3",
            "ACTION"
          ),
          src: demoData.mealNode().address,
          dst: demoData.makeAddress("treasure_octorok#5", "NPC"),
          payload: {},
        });
        const g = demoData.simpleMealGraph().addEdge(edge());
        expect(g.getEdge(edge().address)).toEqual(edge());
      });

      it("allows adding an edge with dangling `src`", () => {
        const edge = () => ({
          address: demoData.makeAddress(
            "health_bar#6@healed_by@seafood_fruit_mix#3",
            "PLAYER_EFFECT"
          ),
          src: demoData.makeAddress("health_bar#6", "PLAYER_STATE"),
          dst: demoData.mealNode().address,
          payload: {},
        });
        const g = demoData.simpleMealGraph().addEdge(edge());
        expect(g.getEdge(edge().address)).toEqual(edge());
      });

      it("forbids adding a node with existing address and different contents", () => {
        expect(() =>
          demoData.simpleMealGraph().addNode({
            address: demoData.crabNode().address,
            payload: {anotherCrab: true},
          })
        ).toThrow(/exists with distinct contents/);
      });

      it("adding a node redundantly is a no-op", () => {
        const simple1 = demoData.simpleMealGraph();
        const simple2 = demoData.simpleMealGraph().addNode(demoData.heroNode());
        expect(simple1.equals(simple2)).toBe(true);
      });

      it("forbids adding an edge with existing address and different contents", () => {
        expect(() =>
          demoData.simpleMealGraph().addEdge({
            address: demoData.cookEdge().address,
            src: demoData.crabNode().address,
            dst: demoData.crabNode().address,
            payload: {isDifferent: true},
          })
        ).toThrow(/exists with distinct contents/);
      });

      it("adding an edge redundantly is a no-op", () => {
        const simple1 = demoData.simpleMealGraph();
        const simple2 = demoData.simpleMealGraph().addEdge(demoData.cookEdge());
        expect(simple1.equals(simple2)).toBe(true);
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

    describe("removing nodes and edges", () => {
      it("is a roundtrip to add and remove and add a node", () => {
        const n = () => demoData.crabNode();

        const g1 = () => new Graph();
        expect(g1().getNode(n().address)).toBeUndefined();

        const g2 = () => g1().addNode(n());
        expect(g2().getNode(n().address)).toEqual(n());

        const g3 = () => g2().removeNode(n().address);
        expect(g3().getNode(n().address)).toBeUndefined();

        const g4 = () => g3().addNode(n());
        expect(g4().getNode(n().address)).toEqual(n());

        expect(g1().equals(g3())).toBe(true);
        expect(g2().equals(g4())).toBe(true);
      });

      it("is a roundtrip to add and remove and add an edge", () => {
        const n = () => demoData.crabNode();
        const e = () => demoData.crabLoopEdge();

        const g1 = () => new Graph().addNode(n());
        expect(g1().getEdge(e().address)).toBeUndefined();

        const g2 = () => g1().addEdge(e());
        expect(g2().getEdge(e().address)).toEqual(e());

        const g3 = () => g2().removeEdge(e().address);
        expect(g3().getEdge(e().address)).toBeUndefined();

        const g4 = () => g3().addEdge(e());
        expect(g4().getEdge(e().address)).toEqual(e());

        expect(g1().equals(g3())).toBe(true);
        expect(g2().equals(g4())).toBe(true);
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

      it("gets empty out-edges for a nonexistent node", () => {
        const result = demoData
          .simpleMealGraph()
          .getOutEdges(demoData.makeAddress("hinox", "NPC"));
        expect(result).toEqual([]);
      });

      it("gets empty in-edges for a nonexistent node", () => {
        const result = demoData
          .simpleMealGraph()
          .getInEdges(demoData.makeAddress("hinox", "NPC"));
        expect(result).toEqual([]);
      });

      {
        const danglingSrc = () => ({
          address: demoData.makeAddress("meaty_rice_balls#8", "FOOD"),
          payload: {meaty: true},
        });
        const danglingDst = () => ({
          address: demoData.makeAddress("treasure_octorok#5", "NPC"),
          payload: {meaty: false},
        });

        // A valid edge neither of whose endpoints are in the default
        // demo meal graph.
        const fullyDanglingEdge = () => ({
          address: demoData.makeAddress(
            "treasure_octorok#5@helps_cook@meaty_rice_balls#8",
            "ACTION"
          ),
          src: danglingSrc().address,
          dst: danglingDst().address,
          payload: {},
        });

        it("has in-edges for deleted node with dangling edge", () => {
          const g = demoData
            .simpleMealGraph()
            .addNode(danglingSrc())
            .addNode(danglingDst())
            .addEdge(fullyDanglingEdge())
            .removeNode(danglingSrc().address)
            .removeNode(danglingDst().address);
          const inEdges = g.getInEdges(fullyDanglingEdge().dst);
          expect(inEdges).toEqual([fullyDanglingEdge()]);
        });

        it("has out-edges for deleted node with dangling edge", () => {
          const g = demoData
            .simpleMealGraph()
            .addNode(danglingSrc())
            .addNode(danglingDst())
            .addEdge(fullyDanglingEdge())
            .removeNode(danglingSrc().address)
            .removeNode(danglingDst().address);
          const outEdges = g.getOutEdges(fullyDanglingEdge().src);
          expect(outEdges).toEqual([fullyDanglingEdge()]);
        });

        it("has lack of in-edges for deleted edge", () => {
          const g = demoData
            .simpleMealGraph()
            .addNode(danglingSrc())
            .addNode(danglingDst())
            .addEdge(fullyDanglingEdge())
            .removeEdge(fullyDanglingEdge().address);
          const outEdges = g.getInEdges(fullyDanglingEdge().dst);
          expect(outEdges).toEqual([]);
        });

        it("has lack of out-edges for deleted edge", () => {
          const g = demoData
            .simpleMealGraph()
            .addNode(danglingSrc())
            .addNode(danglingDst())
            .addEdge(fullyDanglingEdge())
            .removeEdge(fullyDanglingEdge().address);
          const outEdges = g.getOutEdges(fullyDanglingEdge().src);
          expect(outEdges).toEqual([]);
        });

        it("has in-edges for non-existent node with dangling edge", () => {
          const g = demoData.simpleMealGraph().addEdge(fullyDanglingEdge());
          const inEdges = g.getInEdges(fullyDanglingEdge().dst);
          expect(inEdges).toEqual([fullyDanglingEdge()]);
        });

        it("has out-edges for non-existent node with dangling edge", () => {
          const g = demoData.simpleMealGraph().addEdge(fullyDanglingEdge());
          const outEdges = g.getOutEdges(fullyDanglingEdge().src);
          expect(outEdges).toEqual([fullyDanglingEdge()]);
        });

        it("has in-edges that were added before their endpoints", () => {
          const g = demoData
            .simpleMealGraph()
            .addEdge(fullyDanglingEdge())
            .addNode(danglingDst());
          const inEdges = g.getInEdges(fullyDanglingEdge().dst);
          expect(inEdges).toEqual([fullyDanglingEdge()]);
        });

        it("has out-edges that were added before their endpoints", () => {
          const g = demoData
            .simpleMealGraph()
            .addEdge(fullyDanglingEdge())
            .addNode(danglingSrc());
          const outEdges = g.getOutEdges(fullyDanglingEdge().src);
          expect(outEdges).toEqual([fullyDanglingEdge()]);
        });
      }
    });

    describe("when adding edges multiple times", () => {
      const originalGraph = () => demoData.advancedMealGraph();
      const targetEdge = () => demoData.crabLoopEdge();
      const modifiedGraph = () => {
        const g = originalGraph();
        g.addEdge(targetEdge()); // should be redundant
        g.addEdge(targetEdge()); // should be redundant
        return g;
      };
      it("is idempotent in terms of graph equality", () => {
        const g1 = originalGraph();
        const g2 = modifiedGraph();
        expect(g1.equals(g2)).toBe(true);
      });
      it("is idempotent in terms of in-edges", () => {
        const g1 = originalGraph();
        const g2 = modifiedGraph();
        const e1 = sortedByAddress(g1.getInEdges(targetEdge().address));
        const e2 = sortedByAddress(g2.getInEdges(targetEdge().address));
        expect(e1).toEqual(e2);
      });
      it("is idempotent in terms of out-edges", () => {
        const g1 = originalGraph();
        const g2 = modifiedGraph();
        const e1 = sortedByAddress(g1.getOutEdges(targetEdge().address));
        const e2 = sortedByAddress(g2.getOutEdges(targetEdge().address));
        expect(e1).toEqual(e2);
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
        address: demoData.makeAddress("octorok", "NPC"),
        payload: {},
      });
      const extraNode2 = () => ({
        address: demoData.makeAddress("hinox", "NPC"),
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
      function neighborhoodDecomposition<NP, EP>(
        originalGraph: Graph<NP, EP>
      ): Graph<NP, EP>[] {
        return originalGraph.getNodes().map((node) => {
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
      function edgeDecomposition<NP, EP>(
        originalGraph: Graph<NP, EP>
      ): Graph<NP, EP>[] {
        return originalGraph.getEdges().map((edge) => {
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

      it("conservatively merges graphs of different payload types", () => {
        const data = {
          a: () => ({
            address: demoData.makeAddress("a", "EXPERIMENT"),
            payload: "alpha",
          }),
          b: () => ({
            address: demoData.makeAddress("b", "EXPERIMENT"),
            payload: "bravo",
          }),
          u: () => ({
            address: demoData.makeAddress("u", "EXPERIMENT"),
            src: demoData.makeAddress("a", "EXPERIMENT"),
            dst: demoData.makeAddress("b", "EXPERIMENT"),
            payload: 21,
          }),
          c: () => ({
            address: demoData.makeAddress("c", "EXPERIMENT"),
            payload: true,
          }),
          d: () => ({
            address: demoData.makeAddress("d", "EXPERIMENT"),
            payload: false,
          }),
          v: () => ({
            address: demoData.makeAddress("v", "EXPERIMENT"),
            src: demoData.makeAddress("c", "EXPERIMENT"),
            dst: demoData.makeAddress("d", "EXPERIMENT"),
            payload: null,
          }),
        };
        const g1: Graph<string, number> = new Graph()
          .addNode(data.a())
          .addNode(data.b())
          .addEdge(data.u());
        const g2: Graph<boolean, null> = new Graph()
          .addNode(data.c())
          .addNode(data.d())
          .addEdge(data.v());
        type ResultGraph = Graph<string | boolean, number | null>;
        const result: ResultGraph = Graph.mergeConservative(g1, g2);
        const expected: ResultGraph = new Graph()
          .addNode(data.a())
          .addNode(data.b())
          .addEdge(data.u())
          .addNode(data.c())
          .addNode(data.d())
          .addEdge(data.v());
        expect(result.equals(expected)).toBe(true);
      });

      it("conservatively rejects a graph with conflicting nodes", () => {
        const makeGraph: (nodePayload: string) => Graph<*, *> = (nodePayload) =>
          new Graph().addNode({
            address: demoData.makeAddress("conflicting-node", "EXPERIMENT"),
            payload: nodePayload,
          });
        const g1 = makeGraph("one");
        const g2 = makeGraph("two");
        expect(() => {
          Graph.mergeConservative(g1, g2);
        }).toThrow(/distinct nodes with address/);
      });

      it("conservatively rejects a graph with conflicting edges", () => {
        const srcAddress = demoData.makeAddress("src", "EXPERIMENT");
        const dstAddress = demoData.makeAddress("dst", "EXPERIMENT");
        const makeGraph: (edgePayload: string) => Graph<*, *> = (edgePayload) =>
          new Graph()
            .addNode({address: srcAddress, payload: {}})
            .addNode({address: dstAddress, payload: {}})
            .addEdge({
              address: demoData.makeAddress("conflicting-edge", "EXPERIMENT"),
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

    describe("type-checking", () => {
      it("allows adding explicitly typed nodes", () => {
        expect(() => {
          const stringNode: Node<string> = {
            address: demoData.makeAddress("hello", "EXPERIMENT"),
            payload: "hello",
          };
          const numberNode: Node<number> = {
            address: demoData.makeAddress("hello", "EXPERIMENT"),
            payload: 17,
          };
          // This will be a Graph<string | number, *>.
          new Graph().addNode(stringNode).addNode(numberNode);
        });
      });

      it("allows adding explicitly typed edges", () => {
        expect(() => {
          const src = {
            address: demoData.makeAddress("src", "EXPERIMENT"),
            payload: {},
          };
          const dst = {
            address: demoData.makeAddress("dst", "EXPERIMENT"),
            payload: {},
          };
          const stringEdge: Edge<string> = {
            address: demoData.makeAddress("hello", "EXPERIMENT"),
            src: src.address,
            dst: dst.address,
            payload: "hello",
          };
          const numberEdge: Edge<number> = {
            address: demoData.makeAddress("hello", "EXPERIMENT"),
            src: src.address,
            dst: dst.address,
            payload: 18,
          };
          // This will be a Graph<{}, string | number>.
          new Graph()
            .addNode(src)
            .addNode(dst)
            .addEdge(stringEdge)
            .addEdge(numberEdge);
        });
      });
    });

    describe("copy", () => {
      it("separates references from the original", () => {
        const g1 = demoData.advancedMealGraph();
        const g2 = g1.copy();
        const newNode = () => ({
          address: demoData.makeAddress("brand-new", "EXPERIMENT"),
          payload: 777,
        });
        g2.addNode(newNode());
        expect(g1.getNode(newNode().address)).toBeUndefined();
        expect(g2.getNode(newNode().address)).toEqual(newNode());
      });

      it("yields a result equal to the original", () => {
        const g1 = demoData.advancedMealGraph();
        const g2 = g1.copy();
        expect(g1.equals(g2)).toBe(true);
        expect(g1.equals(demoData.advancedMealGraph())).toBe(true);
      });

      function itAllowsUpcastingPayloadTypes(
        g: Graph<{x: string, y: number}, boolean>
      ): Graph<{x: string}, ?boolean> {
        return g.copy();
      }
    });
  });
});
