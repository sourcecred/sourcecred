// @flow

import stringify from "json-stable-stringify";
import {
  NodeAddress,
  EdgeAddress,
  type NodeAddressT,
  type EdgeAddressT,
} from "../core/graph";
import {
  type Weights as WeightsT,
  type NodeWeight,
  type EdgeWeight,
} from "./weights";
import * as Weights from "./weights";
import {toCompat} from "../util/compat";

describe("core/weights", () => {
  function simpleWeights(
    nodeWeights: [string, number][],
    edgeWeights: [string, number, number][]
  ): WeightsT {
    const w = Weights.empty();
    for (const [addrPart, weight] of nodeWeights) {
      w.nodeWeights.set(NodeAddress.fromParts([addrPart]), weight);
    }
    for (const [addrPart, forwards, backwards] of edgeWeights) {
      const weight = {forwards, backwards};
      w.edgeWeights.set(EdgeAddress.fromParts([addrPart]), weight);
    }
    return w;
  }

  function nodeWeight(
    address: string,
    weight: number
  ): [NodeAddressT, NodeWeight] {
    return [NodeAddress.fromParts([address]), weight];
  }

  function edgeWeight(
    address: string,
    forwards: number,
    backwards: number
  ): [EdgeAddressT, EdgeWeight] {
    return [EdgeAddress.fromParts([address]), {forwards, backwards}];
  }

  it("copy makes a copy", () => {
    const w = Weights.empty();
    const w1 = Weights.copy(w);
    w1.nodeWeights.set(NodeAddress.empty, 33);
    w1.edgeWeights.set(EdgeAddress.empty, {forwards: 34, backwards: 39});
    w1.nodeWeights.set(NodeAddress.empty, 35);
    expect(w1).not.toEqual(w);
    expect(w1.nodeWeights).not.toEqual(w.nodeWeights);
    expect(w1.edgeWeights).not.toEqual(w.edgeWeights);
    expect(w1.nodeWeights).not.toEqual(w.nodeWeights);
  });
  describe("toJSON/fromJSON", () => {
    it("works for the default weights", () => {
      const weights = Weights.empty();
      const json = Weights.toJSON(weights);
      const jsonString = stringify(json, {space: 4});
      expect(jsonString).toMatchInlineSnapshot(`
        "[
            {
                \\"type\\": \\"sourcecred/weights\\",
                \\"version\\": \\"0.2.0\\"
            },
            {
                \\"edgeWeights\\": {
                },
                \\"nodeWeights\\": {
                }
            }
        ]"
      `);
      expect(weights).toEqual(Weights.fromJSON(json));
    });

    it("works for non-default weights", () => {
      const weights = Weights.empty();
      weights.nodeWeights.set(NodeAddress.empty, 32);
      weights.edgeWeights.set(EdgeAddress.empty, {
        forwards: 7,
        backwards: 9,
      });
      const json = Weights.toJSON(weights);
      const jsonString = stringify(json, {space: 4});
      expect(jsonString).toMatchInlineSnapshot(`
        "[
            {
                \\"type\\": \\"sourcecred/weights\\",
                \\"version\\": \\"0.2.0\\"
            },
            {
                \\"edgeWeights\\": {
                    \\"E\\\\u0000\\": {
                        \\"backwards\\": 9,
                        \\"forwards\\": 7
                    }
                },
                \\"nodeWeights\\": {
                    \\"N\\\\u0000\\": 32
                }
            }
        ]"
      `);
      expect(weights).toEqual(Weights.fromJSON(json));
    });
  });

  describe("parser", () => {
    it("works for the 0_2_0 format", () => {
      const json: Weights.WeightsJSON_0_2_0 = toCompat(
        {type: "sourcecred/weights", version: "0.2.0"},
        {
          nodeWeights: {},
          edgeWeights: {},
        }
      );
      expect(Weights.parser.parseOrThrow(json)).toEqual(Weights.empty());
    });
  });

  describe("merge", () => {
    it("produces empty weights when given an empty array", () => {
      expect(Weights.merge([])).toEqual(Weights.empty());
    });
    it("produces empty weights when given empty weights", () => {
      expect(Weights.merge([Weights.empty(), Weights.empty()])).toEqual(
        Weights.empty()
      );
    });
    it("returns a copy when given only one weights", () => {
      const w = simpleWeights([["foo", 3]], [["bar", 2, 3]]);
      const wc = Weights.copy(w);
      const merged = Weights.merge([w]);
      expect(merged).toEqual(wc);
      expect(merged).not.toBe(wc);
    });
    it("can merge two non-overlapping weights", () => {
      const w1 = simpleWeights([["foo", 3]], [["bar", 2, 3]]);
      const w2 = simpleWeights([["zod", 4]], [["zoink", 4, 5]]);
      const w3 = simpleWeights(
        [
          ["foo", 3],
          ["zod", 4],
        ],
        [
          ["bar", 2, 3],
          ["zoink", 4, 5],
        ]
      );
      const merged = Weights.merge([w1, w2]);
      expect(merged).toEqual(w3);
    });

    it("uses node resolvers propertly", () => {
      const w1 = simpleWeights(
        [
          ["miss", 100],
          ["hit", 100],
        ],
        []
      );
      const w2 = simpleWeights([["hit", 100]], []);
      const w3 = simpleWeights([["hit", 100]], []);
      const nodeResolver = (a, b) => a + b;
      const edgeResolver = (_unused_a, _unused_b) => {
        throw new Error("edge");
      };
      const resolvers = {nodeResolver, edgeResolver};
      const merged = Weights.merge([w1, w2, w3], resolvers);
      const expected = simpleWeights(
        [
          ["miss", 100],
          ["hit", 300],
        ],
        []
      );
      expect(expected).toEqual(merged);
    });

    it("gives the node address when a node resolver errors", () => {
      const w1 = simpleWeights([["hit", 100]], []);
      const w2 = simpleWeights([["hit", 100]], []);
      expect(() => Weights.merge([w1, w2])).toThrow(
        'when resolving NodeAddress["hit"]'
      );
    });

    it("gives the edge address when a edge resolver errors", () => {
      const w1 = simpleWeights([], [["hit", 3, 3]]);
      const w2 = simpleWeights([], [["hit", 3, 3]]);
      expect(() => Weights.merge([w1, w2])).toThrow(
        'when resolving EdgeAddress["hit"]'
      );
    });

    it("uses edge resolvers propertly", () => {
      const w1 = simpleWeights(
        [],
        [
          ["hit", 3, 3],
          ["miss", 3, 3],
        ]
      );
      const w2 = simpleWeights([], [["hit", 3, 3]]);
      const w3 = simpleWeights([], [["hit", 3, 3]]);
      const nodeResolver = (a, b) => a + b;
      const edgeResolver = (a, b) => ({
        forwards: a.forwards + b.forwards,
        backwards: a.backwards * b.backwards,
      });
      const merged = Weights.merge([w1, w2, w3], {nodeResolver, edgeResolver});
      const expected = simpleWeights(
        [],
        [
          ["hit", 9, 27],
          ["miss", 3, 3],
        ]
      );
      expect(expected).toEqual(merged);
    });

    describe("when no resolvers are provided", () => {
      it("throws an error on overlapping weights with no conflicts", () => {
        const w1 = simpleWeights([["foo", 3]], [["bar", 2, 3]]);
        const w2 = simpleWeights([["foo", 3]], [["bar", 2, 3]]);
        expect(() => Weights.merge([w1, w2])).toThrowError(
          "node weight conflict"
        );
      });
      it("errors on conflicting node weights", () => {
        const w1 = simpleWeights([["foo", 3]], []);
        const w2 = simpleWeights([["foo", 4]], []);
        expect(() => Weights.merge([w1, w2])).toThrowError(
          "node weight conflict"
        );
      });
      it("errors on conflicting edge weights (forwards)", () => {
        const w1 = simpleWeights([], [["foo", 3, 4]]);
        const w2 = simpleWeights([], [["foo", 4, 4]]);
        expect(() => Weights.merge([w1, w2])).toThrowError(
          "edge weight conflict"
        );
      });
      it("errors on conflicting edge weights (backwards)", () => {
        const w1 = simpleWeights([], [["foo", 4, 4]]);
        const w2 = simpleWeights([], [["foo", 4, 5]]);
        expect(() => Weights.merge([w1, w2])).toThrowError(
          "edge weight conflict"
        );
      });
    });
  });

  describe("compareWeights", () => {
    describe("simple weights are equal with no differences", () => {
      const w1 = simpleWeights(
        [
          ["foo", 3],
          ["zod", 4],
        ],
        [
          ["bar", 2, 3],
          ["zoink", 4, 5],
        ]
      );
      const w2 = simpleWeights(
        [
          ["foo", 3],
          ["zod", 4],
        ],
        [
          ["bar", 2, 3],
          ["zoink", 4, 5],
        ]
      );

      it("returns empty arrays", () => {
        const expected = {
          weightsAreEqual: true,
          uniqueNodesInFirst: [],
          uniqueNodesInSecond: [],
          nodeTuplesWithDifferences: [],
          uniqueEdgesInFirst: [],
          uniqueEdgesInSecond: [],
          edgeTuplesWithDifferences: [],
        };
        expect(Weights.compareWeights(w1, w2)).toEqual(expected);
      });
    });

    describe("simple weights are equal but in different orders", () => {
      const w1 = simpleWeights(
        [
          ["zod", 4],
          ["foo", 3],
        ],
        [
          ["zoink", 4, 5],
          ["bar", 2, 3],
        ]
      );
      const w2 = simpleWeights(
        [
          ["foo", 3],
          ["zod", 4],
        ],
        [
          ["bar", 2, 3],
          ["zoink", 4, 5],
        ]
      );

      it("returns empty arrays", () => {
        const expected = {
          weightsAreEqual: true,
          uniqueNodesInFirst: [],
          uniqueNodesInSecond: [],
          nodeTuplesWithDifferences: [],
          uniqueEdgesInFirst: [],
          uniqueEdgesInSecond: [],
          edgeTuplesWithDifferences: [],
        };
        expect(Weights.compareWeights(w1, w2)).toEqual(expected);
      });
    });

    describe("both weights have unique addresses", () => {
      const w1 = simpleWeights(
        [
          ["unique1", 3],
          ["zod", 4],
        ],
        [
          ["unique2", 2, 3],
          ["zoink", 4, 5],
        ]
      );
      const w2 = simpleWeights(
        [
          ["unique3", 3],
          ["zod", 4],
        ],
        [
          ["unique4", 2, 3],
          ["zoink", 4, 5],
        ]
      );

      it("returns the unique contents", () => {
        const expected = {
          weightsAreEqual: false,
          uniqueNodesInFirst: [nodeWeight("unique1", 3)],
          uniqueNodesInSecond: [nodeWeight("unique3", 3)],
          nodeTuplesWithDifferences: [],
          uniqueEdgesInFirst: [edgeWeight("unique2", 2, 3)],
          uniqueEdgesInSecond: [edgeWeight("unique4", 2, 3)],
          edgeTuplesWithDifferences: [],
        };
        expect(Weights.compareWeights(w1, w2)).toEqual(expected);
      });
    });

    describe("weights have different values", () => {
      const w1 = simpleWeights(
        [
          ["foo", 3],
          ["zod", 6],
        ],
        [
          ["bar", 2, 3],
          ["zoink", 4, 5],
        ]
      );
      const w2 = simpleWeights(
        [
          ["foo", 3],
          ["zod", 4],
        ],
        [
          ["bar", 2, 3],
          ["zoink", 5, 4],
        ]
      );

      it("returns the differing pairs", () => {
        const expected = {
          weightsAreEqual: false,
          uniqueNodesInFirst: [],
          uniqueNodesInSecond: [],
          nodeTuplesWithDifferences: [
            [nodeWeight("zod", 6), nodeWeight("zod", 4)],
          ],
          uniqueEdgesInFirst: [],
          uniqueEdgesInSecond: [],
          edgeTuplesWithDifferences: [
            [edgeWeight("zoink", 4, 5), edgeWeight("zoink", 5, 4)],
          ],
        };
        expect(Weights.compareWeights(w1, w2)).toEqual(expected);
      });
    });
  });
});
