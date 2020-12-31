// @flow

import stringify from "json-stable-stringify";
import {NodeAddress, EdgeAddress} from "../graph";
import {
  Weights,
  type WeightsI,
  fromJSON,
  areEqual,
  weightsTToWeights,
} from "./weights";
import {simpleWeightsT} from "./weightsT.test";

function simpleWeights(
  nodeWeightsT: [string, number][],
  edgeWeightsT: [string, number, number][]
): WeightsI {
  const w = simpleWeightsT(nodeWeightsT, edgeWeightsT);
  return weightsTToWeights(w.nodeWeightsT, w.edgeWeightsT);
}

describe("core/weights/weights", () => {
  describe("get/setNodeWeight", () => {
    const empty = NodeAddress.fromParts([]);
    const foo = NodeAddress.fromParts(["foo"]);
    const foobar = NodeAddress.fromParts(["foo", "bar"]);

    it("gives every node weight 1 with empty types and weights", () => {
      const W = Weights();
      expect(W.getNodeWeight(empty)).toEqual(1);
      expect(W.getNodeWeight(foo)).toEqual(1);
    });

    it("composes matching weights multiplicatively", () => {
      const W = Weights();
      W.setNodeWeight(foo, 2);
      W.setNodeWeight(foobar, 3);
      expect(W.getNodeWeight(empty)).toEqual(1);
      expect(W.getNodeWeight(foo)).toEqual(2);
      expect(W.getNodeWeight(foobar)).toEqual(6);
    });
  });

  describe("get/setEdgeWeight", () => {
    const foo = EdgeAddress.fromParts(["foo"]);
    const foobar = EdgeAddress.fromParts(["foo", "bar"]);
    it("gives default 1,1 weights if no matching type", () => {
      const W = Weights();
      expect(W.getEdgeWeight(foo)).toEqual({forwards: 1, backwards: 1});
    });

    it("composes weights multiplicatively for all matching types", () => {
      const W = Weights();
      W.setEdgeWeight(foo, {forwards: 2, backwards: 3});
      W.setEdgeWeight(foobar, {forwards: 4, backwards: 5});
      expect(W.getEdgeWeight(foo)).toEqual({forwards: 2, backwards: 3});
      expect(W.getEdgeWeight(foobar)).toEqual({forwards: 8, backwards: 15});
      expect(
        W.getEdgeWeight(EdgeAddress.fromParts(["foo", "bar", "qox"]))
      ).toEqual({
        forwards: 8,
        backwards: 15,
      });
    });
  });

  describe("merge", () => {
    it("produces empty weights when given empty weights", () => {
      const emptyMerged = Weights().merge([Weights()]);
      expect(areEqual(emptyMerged, Weights())).toBe(true);
    });

    it("returns a copy when no weights merged", () => {
      const W = simpleWeights([["foo", 3]], [["bar", 2, 3]]);
      const merged = W.merge([]);
      expect(areEqual(merged, W)).toBe(true);
      expect(merged).not.toBe(W);
    });

    it("can merge two non-overlapping weights", () => {
      const W1 = simpleWeights([["foo", 3]], [["bar", 2, 3]]);
      const W2 = simpleWeights([["zod", 4]], [["zoink", 4, 5]]);
      const expected = simpleWeights(
        [
          ["foo", 3],
          ["zod", 4],
        ],
        [
          ["bar", 2, 3],
          ["zoink", 4, 5],
        ]
      );
      const merged = W1.merge([W2]);
      expect(areEqual(merged, expected)).toBe(true);
    });

    it("uses node resolvers propertly", () => {
      const W1 = simpleWeights(
        [
          ["miss", 100],
          ["hit", 100],
        ],
        []
      );
      const W2 = simpleWeights([["hit", 100]], []);
      const W3 = simpleWeights([["hit", 100]], []);
      const nodeResolver = (a, b) => a + b;
      const edgeResolver = (_unused_a, _unused_b) => {
        throw new Error("edge");
      };
      const resolvers = {nodeResolver, edgeResolver};
      const merged = W1.merge([W2, W3], resolvers);

      const expected = simpleWeights(
        [
          ["miss", 100],
          ["hit", 300],
        ],
        []
      );
      expect(areEqual(merged, expected)).toBe(true);
    });

    it("gives the node address when a node resolver errors", () => {
      const W1 = simpleWeights([["hit", 100]], []);
      const W2 = simpleWeights([["hit", 100]], []);
      expect(() => W1.merge([W2])).toThrow('when resolving NodeAddress["hit"]');
    });

    it("gives the edge address when a edge resolver errors", () => {
      const W1 = simpleWeights([], [["hit", 3, 3]]);
      const W2 = simpleWeights([], [["hit", 3, 3]]);
      expect(() => W1.merge([W2])).toThrow('when resolving EdgeAddress["hit"]');
    });

    it("uses edge resolvers propertly", () => {
      const W1 = simpleWeights(
        [],
        [
          ["hit", 3, 3],
          ["miss", 3, 3],
        ]
      );
      const W2 = simpleWeights([], [["hit", 3, 3]]);
      const W3 = simpleWeights([], [["hit", 3, 3]]);
      const nodeResolver = (a, b) => a + b;
      const edgeResolver = (a, b) => ({
        forwards: a.forwards + b.forwards,
        backwards: a.backwards * b.backwards,
      });
      const merged = W1.merge([W2, W3], {nodeResolver, edgeResolver});

      const expected = simpleWeights(
        [],
        [
          ["hit", 9, 27],
          ["miss", 3, 3],
        ]
      );
      expect(areEqual(merged, expected)).toBe(true);
    });

    describe("when no resolvers are provided", () => {
      it("throws an error on overlapping weights with no conflicts", () => {
        const W1 = simpleWeights([["foo", 3]], [["bar", 2, 3]]);
        const W2 = simpleWeights([["foo", 3]], [["bar", 2, 3]]);
        expect(() => W1.merge([W2])).toThrowError("node weight conflict");
      });
      it("errors on conflicting node weights", () => {
        const W1 = simpleWeights([["foo", 3]], []);
        const W2 = simpleWeights([["foo", 4]], []);
        expect(() => W1.merge([W2])).toThrowError("node weight conflict");
      });
      it("errors on conflicting edge weights (forwards)", () => {
        const W1 = simpleWeights([], [["foo", 3, 4]]);
        const W2 = simpleWeights([], [["foo", 4, 4]]);
        expect(() => W1.merge([W2])).toThrowError("edge weight conflict");
      });
      it("errors on conflicting edge weights (backwards)", () => {
        const W1 = simpleWeights([], [["foo", 4, 4]]);
        const W2 = simpleWeights([], [["foo", 4, 5]]);
        expect(() => W1.merge([W2])).toThrowError("edge weight conflict");
      });
    });
  });

  describe("copy", () => {
    it("returns a copied class", () => {
      const W = simpleWeights([["bar", 3]], [["foo", 4, 4]]);
      const W1 = W.copy();

      expect(W).not.toBe(W1);
      expect(W.nodeWeightsT()).not.toBe(W1.nodeWeightsT());
      expect(W.edgeWeightsT()).not.toBe(W1.edgeWeightsT());

      expect(areEqual(W, W1)).toBe(true);
      expect(W.nodeWeightsT()).toEqual(W1.nodeWeightsT());
      expect(W.edgeWeightsT()).toEqual(W1.edgeWeightsT());
    });
  });

  describe("toJSON (todo: /fromJSON)", () => {
    it("works for the default weights", () => {
      const W = Weights();
      const json = W.toJSON();
      const jsonString = stringify(json, {space: 4});
      const expected = fromJSON(json);
      expect(jsonString).toMatchInlineSnapshot(`
        "[
            {
                \\"type\\": \\"sourcecred/weights\\",
                \\"version\\": \\"0.2.0\\"
            },
            {
                \\"edgeWeightsT\\": {
                },
                \\"nodeWeightsT\\": {
                }
            }
        ]"
      `);
      expect(areEqual(W, expected)).toBe(true);
    });

    it("works for non-default weights", () => {
      const W = Weights();
      W.setNodeWeight(NodeAddress.empty, 32);
      W.setEdgeWeight(EdgeAddress.empty, {
        forwards: 7,
        backwards: 9,
      });
      const json = W.toJSON();
      const jsonString = stringify(json, {space: 4});
      const expected = fromJSON(json);
      expect(jsonString).toMatchInlineSnapshot(`
        "[
            {
                \\"type\\": \\"sourcecred/weights\\",
                \\"version\\": \\"0.2.0\\"
            },
            {
                \\"edgeWeightsT\\": {
                    \\"E\\\\u0000\\": {
                        \\"backwards\\": 9,
                        \\"forwards\\": 7
                    }
                },
                \\"nodeWeightsT\\": {
                    \\"N\\\\u0000\\": 32
                }
            }
        ]"
      `);
      expect(areEqual(W, expected)).toBe(true);
    });
  });
});
