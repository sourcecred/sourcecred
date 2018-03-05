// @flow

import type {Address, Addressable} from "./address";
import {sortedByAddress} from "./address";
import {Graph} from "./graph";

describe("graph", () => {
  describe("#Graph", () => {
    // Some Graph functions return a set of results represented as an
    // array with undefined order. We canonicalize the ordering so that
    // we can then test equality with `expect(...).toEqual(...)`.
    function expectSameSorted<T: Addressable>(xs: T[], ys: T[]) {
      expect(sortedByAddress(xs)).toEqual(sortedByAddress(ys));
    }

    // A Seafood Fruit Mix is made by cooking Mighty Bananas (picked
    // from a tree) and a Razorclaw Crab (grabbed from the beach). In
    // this graph, an edge from `u` to `v` means that `u` thanks `v` for
    // a particular contribution. For example, the meal thanks the hero
    // for cooking it, as well as thanking the bananas and the crab for
    // composing it.
    function makeAddress(id: string): Address {
      return {
        repositoryName: "sourcecred/eventide",
        pluginName: "hill_cooking_pot",
        id,
      };
    }
    const heroNode = () => ({
      address: makeAddress("hero_of_time#0"),
      payload: {},
    });
    const bananasNode = () => ({
      address: makeAddress("mighty_bananas#1"),
      payload: {},
    });
    const crabNode = () => ({
      address: makeAddress("razorclaw_crab#2"),
      payload: {},
    });
    const mealNode = () => ({
      address: makeAddress("seafood_fruit_mix#3"),
      payload: {
        effect: ["attack_power", 1],
      },
    });
    const pickEdge = () => ({
      address: makeAddress("hero_of_time#0@picks@mighty_bananas#1"),
      src: bananasNode().address,
      dst: heroNode().address,
      payload: {},
    });
    const grabEdge = () => ({
      address: makeAddress("hero_of_time#0@grabs@razorclaw_crab#2"),
      src: crabNode().address,
      dst: heroNode().address,
      payload: {},
    });
    const cookEdge = () => ({
      address: makeAddress("hero_of_time#0@cooks@seafood_fruit_mix#3"),
      src: mealNode().address,
      dst: heroNode().address,
      payload: {
        crit: false,
      },
    });
    const bananasIngredientEdge = () => ({
      address: makeAddress("mighty_bananas#1@included_in@seafood_fruit_mix#3"),
      src: mealNode().address,
      dst: bananasNode().address,
      payload: {},
    });
    const crabIngredientEdge = () => ({
      address: makeAddress("razorclaw_crab#2@included_in@seafood_fruit_mix#3"),
      src: mealNode().address,
      dst: crabNode().address,
      payload: {},
    });
    const eatEdge = () => ({
      address: makeAddress("hero_of_time#0@eats@seafood_fruit_mix#3"),
      src: heroNode().address,
      dst: mealNode().address,
      payload: {},
    });
    const simpleMealGraph = () =>
      new Graph()
        .addNode(heroNode())
        .addNode(bananasNode())
        .addNode(crabNode())
        .addNode(mealNode())
        .addEdge(pickEdge())
        .addEdge(grabEdge())
        .addEdge(cookEdge())
        .addEdge(bananasIngredientEdge())
        .addEdge(crabIngredientEdge())
        .addEdge(eatEdge());

    const crabLoopEdge = () => ({
      address: makeAddress("crab-self-assessment"),
      src: crabNode().address,
      dst: crabNode().address,
      payload: {evaluation: "not effective at avoiding hero"},
    });

    const duplicateCookEdge = () => ({
      address: makeAddress("hero_of_time#0@again_cooks@seafood_fruit_mix#3"),
      src: mealNode().address,
      dst: heroNode().address,
      payload: {
        crit: true,
        saveScummed: true,
      },
    });

    const advancedMealGraph = () =>
      simpleMealGraph()
        .addEdge(crabLoopEdge())
        .addEdge(duplicateCookEdge());

    describe("construction", () => {
      it("works for a simple graph", () => {
        simpleMealGraph();
      });

      it("works for an advanced graph", () => {
        advancedMealGraph();
      });

      it("forbids adding an edge with dangling `dst`", () => {
        expect(() => {
          simpleMealGraph().addEdge({
            address: makeAddress(
              "treasure_octorok#5@helps_cook@seafood_fruit_mix#3"
            ),
            src: mealNode().address,
            dst: makeAddress("treasure_octorok#5"),
            payload: {},
          });
        }).toThrow(/does not exist/);
      });

      it("forbids adding an edge with dangling `src`", () => {
        expect(() => {
          simpleMealGraph().addEdge({
            address: makeAddress("health_bar#6@healed_by@seafood_fruit_mix#3"),
            src: makeAddress("health_bar#6"),
            dst: mealNode().address,
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
        const g = simpleMealGraph();
        [heroNode(), bananasNode(), crabNode(), mealNode()].forEach((x) => {
          expect(g.getNode(x.address)).toEqual(x);
        });
      });

      it("correctly gets nodes in the advanced graph", () => {
        const g = advancedMealGraph();
        [heroNode(), bananasNode(), crabNode(), mealNode()].forEach((x) => {
          expect(g.getNode(x.address)).toEqual(x);
        });
      });

      it("correctly gets edges in the simple graph", () => {
        const g = simpleMealGraph();
        [
          pickEdge(),
          grabEdge(),
          cookEdge(),
          bananasIngredientEdge(),
          crabIngredientEdge(),
          eatEdge(),
        ].forEach((x) => {
          expect(g.getEdge(x.address)).toEqual(x);
        });
      });

      it("correctly gets edges in the advanced graph", () => {
        const g = advancedMealGraph();
        [
          pickEdge(),
          grabEdge(),
          cookEdge(),
          bananasIngredientEdge(),
          crabIngredientEdge(),
          eatEdge(),
          crabLoopEdge(),
          duplicateCookEdge(),
        ].forEach((x) => {
          expect(g.getEdge(x.address)).toEqual(x);
        });
      });

      it("returns `undefined` for nodes that do not exist", () => {
        expect(
          simpleMealGraph().getNode(makeAddress("treasure_octorok#5"))
        ).toBeUndefined();
      });

      it("returns `undefined` for edges that do not exist", () => {
        expect(
          simpleMealGraph().getNode(
            makeAddress("treasure_octorok#5@helps_cook@seafood_fruit_mix#3")
          )
        ).toBeUndefined();
      });

      it("gets all nodes", () => {
        const expected = [heroNode(), bananasNode(), crabNode(), mealNode()];
        const actual = advancedMealGraph().getAllNodes();
        expectSameSorted(expected, actual);
      });

      it("gets all edges", () => {
        const expected = [
          pickEdge(),
          grabEdge(),
          cookEdge(),
          bananasIngredientEdge(),
          crabIngredientEdge(),
          eatEdge(),
          crabLoopEdge(),
          duplicateCookEdge(),
        ];
        const actual = advancedMealGraph().getAllEdges();
        expectSameSorted(expected, actual);
      });
    });

    describe("creating nodes and edges", () => {
      it("forbids adding a node with existing address", () => {
        expect(() =>
          simpleMealGraph().addNode({
            address: crabNode().address,
            payload: {anotherCrab: true},
          })
        ).toThrow(/already exists/);
      });

      it("forbids adding an edge with existing address", () => {
        expect(() =>
          simpleMealGraph().addEdge({
            address: cookEdge().address,
            src: crabNode().address,
            dst: crabNode().address,
            payload: {},
          })
        ).toThrow(/already exists/);
      });

      it("allows creating self-loops", () => {
        const g = simpleMealGraph();
        g.addEdge(crabLoopEdge());
        expect(g.getOutEdges(crabNode().address)).toContainEqual(
          crabLoopEdge()
        );
        expect(g.getInEdges(crabNode().address)).toContainEqual(crabLoopEdge());
      });

      it("allows creating multiple edges between the same nodes", () => {
        const g = simpleMealGraph();
        g.addEdge(duplicateCookEdge());
        [cookEdge(), duplicateCookEdge()].forEach((e) => {
          expect(g.getOutEdges(mealNode().address)).toContainEqual(e);
          expect(g.getEdge(e.address)).toEqual(e);
        });
      });

      // For the next two test cases: we're documenting this behavior,
      // though we're not sure if it's the right behavior. Perhaps we want
      // the namespaces to be forced to be disjoint. In that case, we can
      // certainly change these tests.
      it("allows adding an edge with an existing node's address", () => {
        simpleMealGraph().addEdge({
          address: crabNode().address,
          src: crabNode().address,
          dst: crabNode().address,
          payload: {message: "thanks for being you"},
        });
      });
      it("allows adding a node with an existing edge's address", () => {
        simpleMealGraph().addNode({
          address: cookEdge().address,
          payload: {},
        });
      });
    });

    describe("in- and out-edges", () => {
      it("gets out-edges", () => {
        const nodeAndExpectedEdgePairs = [
          [heroNode(), [eatEdge()]],
          [bananasNode(), [pickEdge()]],
          [crabNode(), [grabEdge(), crabLoopEdge()]],
          [
            mealNode(),
            [
              bananasIngredientEdge(),
              crabIngredientEdge(),
              cookEdge(),
              duplicateCookEdge(),
            ],
          ],
        ];
        nodeAndExpectedEdgePairs.forEach(([node, expectedEdges]) => {
          const actual = advancedMealGraph().getOutEdges(node.address);
          expectSameSorted(actual, expectedEdges);
        });
      });

      it("gets in-edges", () => {
        const nodeAndExpectedEdgePairs = [
          [
            heroNode(),
            [pickEdge(), grabEdge(), cookEdge(), duplicateCookEdge()],
          ],
          [bananasNode(), [bananasIngredientEdge()]],
          [crabNode(), [crabIngredientEdge(), crabLoopEdge()]],
          [mealNode(), [eatEdge()]],
        ];
        nodeAndExpectedEdgePairs.forEach(([node, expectedEdges]) => {
          const actual = advancedMealGraph().getInEdges(node.address);
          expectSameSorted(actual, expectedEdges);
        });
      });

      it("fails to get out-edges for a nonexistent node", () => {
        expect(() => {
          simpleMealGraph().getOutEdges(makeAddress("hinox"));
        }).toThrow(/no node for address/);
      });

      it("fails to get in-edges for a nonexistent node", () => {
        expect(() => {
          simpleMealGraph().getInEdges(makeAddress("hinox"));
        }).toThrow(/no node for address/);
      });
    });

    describe("#equals", () => {
      it("returns true for identity-equal graphs", () => {
        const g = advancedMealGraph();
        expect(g.equals(g)).toBe(true);
      });
      it("returns true for deep-equal graphs", () => {
        expect(advancedMealGraph().equals(advancedMealGraph())).toBe(true);
      });
      it("returns false when the LHS has nodes missing in the RHS", () => {
        expect(advancedMealGraph().equals(simpleMealGraph())).toBe(false);
      });
      it("returns false when the RHS has nodes missing in the LHS", () => {
        expect(simpleMealGraph().equals(advancedMealGraph())).toBe(false);
      });
      const extraNode1 = () => ({
        address: makeAddress("octorok"),
        payload: {},
      });
      const extraNode2 = () => ({
        address: makeAddress("hinox"),
        payload: {status: "sleeping"},
      });
      it("returns false when the LHS has edges missing in the RHS", () => {
        const g1 = advancedMealGraph();
        const g2 = advancedMealGraph().addNode(extraNode1());
        expect(g1.equals(g2)).toBe(false);
      });
      it("returns false when the LHS has edges missing in the RHS", () => {
        const g1 = advancedMealGraph().addNode(extraNode1());
        const g2 = advancedMealGraph();
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
        const result = neighborhoodDecomposition(advancedMealGraph()).reduce(
          (g1, g2) => Graph.mergeConservative(g1, g2),
          new Graph()
        );
        expect(result.equals(advancedMealGraph())).toBe(true);
      });

      it("conservatively recomposes an edge decomposition", () => {
        const result = edgeDecomposition(advancedMealGraph()).reduce(
          (g1, g2) => Graph.mergeConservative(g1, g2),
          new Graph()
        );
        expect(result.equals(advancedMealGraph())).toBe(true);
      });

      it("conservatively merges a graph with itself", () => {
        const result = Graph.mergeConservative(
          advancedMealGraph(),
          advancedMealGraph()
        );
        expect(result.equals(advancedMealGraph())).toBe(true);
      });

      it("conservatively rejects a graph with conflicting nodes", () => {
        const makeGraph: (nodePayload: string) => Graph = (nodePayload) =>
          new Graph().addNode({
            address: makeAddress("conflicting-node"),
            payload: nodePayload,
          });
        const g1 = makeGraph("one");
        const g2 = makeGraph("two");
        expect(() => {
          Graph.mergeConservative(g1, g2);
        }).toThrow(/distinct nodes with address/);
      });

      it("conservatively rejects a graph with conflicting edges", () => {
        const srcAddress = makeAddress("src");
        const dstAddress = makeAddress("dst");
        const makeGraph: (edgePayload: string) => Graph = (edgePayload) =>
          new Graph()
            .addNode({address: srcAddress, payload: {}})
            .addNode({address: dstAddress, payload: {}})
            .addEdge({
              address: makeAddress("conflicting-edge"),
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
          advancedMealGraph(),
          assertNotCalled,
          assertNotCalled
        );
        expect(merged.equals(advancedMealGraph())).toBe(true);
      });
      it("has the empty graph as a right identity", () => {
        const merged = Graph.merge(
          advancedMealGraph(),
          new Graph(),
          assertNotCalled,
          assertNotCalled
        );
        expect(merged.equals(advancedMealGraph())).toBe(true);
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
  });
});
