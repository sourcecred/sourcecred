// @flow

import type {Address} from "./graph";
import {Graph, addressToString, stringToAddress} from "./graph";

describe("graph", () => {
  describe("#Graph", () => {
    // Some Graph functions return a set of results represented as an
    // array with undefined order. We use these functions to
    // canonicalize the ordering so that we can then test equality with
    // `expect(...).toEqual(...)`.
    function sortedByAddress<T: {address: Address}>(xs: T[]) {
      function cmp(x1: T, x2: T) {
        const a1 = addressToString(x1.address);
        const a2 = addressToString(x2.address);
        return a1 > a2 ? 1 : a1 < a2 ? -1 : 0;
      }
      return [...xs].sort(cmp);
    }
    function expectSameSorted<T: {address: Address}>(xs: T[], ys: T[]) {
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
    const mealGraph = () =>
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

    describe("construction", () => {
      it("works for a simple graph", () => {
        mealGraph();
      });

      it("forbids adding an edge with dangling `dst`", () => {
        expect(() => {
          mealGraph().addEdge({
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
          mealGraph().addEdge({
            address: makeAddress("health_bar#6@healed_by@seafood_fruit_mix#3"),
            src: makeAddress("health_bar#6"),
            dst: mealNode().address,
            payload: {},
          });
        }).toThrow(/does not exist/);
      });
    });

    describe("getting nodes and edges", () => {
      it("correctly gets nodes that exist", () => {
        const g = mealGraph();
        [heroNode(), bananasNode(), crabNode(), mealNode()].forEach((x) => {
          expect(g.getNode(x.address)).toEqual(x);
        });
      });

      it("correctly gets edges that exist", () => {
        const g = mealGraph();
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

      it("returns `undefined` for nodes that do not exist", () => {
        expect(
          mealGraph().getNode(makeAddress("treasure_octorok#5"))
        ).toBeUndefined();
      });

      it("returns `undefined` for edges that do not exist", () => {
        expect(
          mealGraph().getNode(
            makeAddress("treasure_octorok#5@helps_cook@seafood_fruit_mix#3")
          )
        ).toBeUndefined();
      });

      it("forbids adding a node with existing address", () => {
        expect(() =>
          mealGraph().addNode({
            address: crabNode().address,
            payload: {anotherCrab: true},
          })
        ).toThrow(/already exists/);
      });

      it("forbids adding an edge with existing address", () => {
        expect(() =>
          mealGraph().addEdge({
            address: cookEdge().address,
            src: crabNode().address,
            dst: crabNode().address,
            payload: {},
          })
        ).toThrow(/already exists/);
      });

      it("allows creating self-loops", () => {
        const g = mealGraph();
        const crabLoop = {
          address: makeAddress("crab-self-assessment"),
          src: crabNode().address,
          dst: crabNode().address,
          payload: {evaluation: "not effective at avoiding hero"},
        };
        g.addEdge(crabLoop);
        expect(g.getOutEdges(crabNode().address)).toContainEqual(crabLoop);
        expect(g.getInEdges(crabNode().address)).toContainEqual(crabLoop);
      });

      it("allows creating multiple edges between the same nodes", () => {
        const g = mealGraph();
        const critCookEdge = () => ({
          address: makeAddress(
            "hero_of_time#0@again_cooks@seafood_fruit_mix#3"
          ),
          src: mealNode().address,
          dst: heroNode().address,
          payload: {
            crit: true,
            saveScummed: true,
          },
        });
        g.addEdge(critCookEdge());
        [cookEdge(), critCookEdge()].forEach((e) => {
          expect(g.getOutEdges(mealNode().address)).toContainEqual(e);
          expect(g.getEdge(e.address)).toEqual(e);
        });
      });

      it("gets all nodes", () => {
        const expected = [heroNode(), bananasNode(), crabNode(), mealNode()];
        const actual = mealGraph().getAllNodes();
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
        ];
        const actual = mealGraph().getAllEdges();
        expectSameSorted(expected, actual);
      });

      // For the next two test cases: we're documenting this behavior,
      // though we're not sure if it's the right behavior. Perhaps we want
      // the namespaces to be forced to be disjoint. In that case, we can
      // certainly change these tests.
      it("allows adding an edge with an existing node's address", () => {
        mealGraph().addEdge({
          address: crabNode().address,
          src: crabNode().address,
          dst: crabNode().address,
          payload: {message: "thanks for being you"},
        });
      });
      it("allows adding a node with an existing edge's address", () => {
        mealGraph().addNode({
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
          [crabNode(), [grabEdge()]],
          [
            mealNode(),
            [bananasIngredientEdge(), crabIngredientEdge(), cookEdge()],
          ],
        ];
        nodeAndExpectedEdgePairs.forEach(([node, expectedEdges]) => {
          const actual = mealGraph().getOutEdges(node.address);
          expectSameSorted(actual, expectedEdges);
        });
      });

      it("gets in-edges", () => {
        const nodeAndExpectedEdgePairs = [
          [heroNode(), [pickEdge(), grabEdge(), cookEdge()]],
          [bananasNode(), [bananasIngredientEdge()]],
          [crabNode(), [crabIngredientEdge()]],
          [mealNode(), [eatEdge()]],
        ];
        nodeAndExpectedEdgePairs.forEach(([node, expectedEdges]) => {
          const actual = mealGraph().getInEdges(node.address);
          expectSameSorted(actual, expectedEdges);
        });
      });

      it("fails to get out-edges for a nonexistent node", () => {
        expect(() => {
          mealGraph().getOutEdges(makeAddress("hinox"));
        }).toThrow(/no node for address/);
      });

      it("fails to get in-edges for a nonexistent node", () => {
        expect(() => {
          mealGraph().getInEdges(makeAddress("hinox"));
        }).toThrow(/no node for address/);
      });
    });
  });

  describe("string functions", () => {
    describe("addressToString", () => {
      const makeSimpleAddress = () => ({
        repositoryName: "megacorp/megawidget",
        pluginName: "widgets",
        id: "issue#123",
      });
      it("stringifies a simple Address", () => {
        const input = makeSimpleAddress();
        const expected = "megacorp/megawidget$widgets$issue#123";
        expect(addressToString(input)).toEqual(expected);
      });
      function expectRejection(attribute, value) {
        const input = {...makeSimpleAddress(), [attribute]: value};
        expect(() => addressToString(input)).toThrow(RegExp(attribute));
        // (escaping regexp in JavaScript is a nightmare; ignore it)
      }
      it("rejects an Address with $-signs in plugin name", () => {
        expectRejection("pluginName", "widg$ets");
      });
      it("rejects an Address with $-signs in repository name", () => {
        expectRejection("repositoryName", "megacorp$megawidget");
      });
      it("rejects an Address with $-signs in id", () => {
        expectRejection("id", "issue$123");
      });
    });

    describe("stringToAddress", () => {
      it("parses a simple Address-string", () => {
        const input = "megacorp/megawidget$widgets$issue#123";
        const expected = {
          repositoryName: "megacorp/megawidget",
          pluginName: "widgets",
          id: "issue#123",
        };
        expect(stringToAddress(input)).toEqual(expected);
      });
      [0, 1, 3, 4].forEach((n) => {
        it(`rejects an Address-string with ${n} occurrences of "\$"`, () => {
          const dollars = Array(n + 1).join("$");
          const input = `mega${dollars}corp`;
          expect(() => stringToAddress(input)).toThrow(/exactly two \$s/);
        });
      });
    });

    describe("stringToAddress and addressToString interop", () => {
      const examples = () => [
        {
          object: {
            repositoryName: "megacorp/megawidget",
            pluginName: "widgets",
            id: "issue#123",
          },
          string: "megacorp/megawidget$widgets$issue#123",
        },
      ];
      examples().forEach((example, index) => {
        describe(`for example at 0-index ${index}`, () => {
          it("has stringToAddress a left identity for addressToString", () => {
            expect(stringToAddress(addressToString(example.object))).toEqual(
              example.object
            );
          });
          it("has stringToAddress a right identity for addressToString", () => {
            expect(addressToString(stringToAddress(example.string))).toEqual(
              example.string
            );
          });
        });
      });
    });
  });
});
