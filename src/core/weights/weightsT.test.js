// @flow

import stringify from "json-stable-stringify";
import {
  type WeightsT,
  type WeightsJSON_0_2_0,
  empty as emptyWeightsT,
  copy as copyWeightsT,
  merge as mergeWeightsT,
  toJSON as toJSONWeightsT,
  fromJSON,
  parser,
  compareWeightsT,
} from "./weightsT";
import {NodeAddress, EdgeAddress} from "../graph";
import {toCompat} from "../../util/compat";

export function simpleWeightsT(
  nodeWeightsT: [string, number][],
  edgeWeightsT: [string, number, number][]
): WeightsT {
  const w = emptyWeightsT();
  for (const [addrPart, weight] of nodeWeightsT) {
    w.nodeWeightsT.set(NodeAddress.fromParts([addrPart]), weight);
  }
  for (const [addrPart, forwards, backwards] of edgeWeightsT) {
    const weight = {forwards, backwards};
    w.edgeWeightsT.set(EdgeAddress.fromParts([addrPart]), weight);
  }
  return w;
}

describe("core/weights/weightsT", () => {
  it("copy makes a copy", () => {
    const w = emptyWeightsT();
    const w1 = copyWeightsT(w);
    w1.nodeWeightsT.set(NodeAddress.empty, 33);
    w1.edgeWeightsT.set(EdgeAddress.empty, {forwards: 34, backwards: 39});
    w1.nodeWeightsT.set(NodeAddress.empty, 35);
    expect(w1).not.toEqual(w);
    expect(w1.nodeWeightsT).not.toEqual(w.nodeWeightsT);
    expect(w1.edgeWeightsT).not.toEqual(w.edgeWeightsT);
    expect(w1.nodeWeightsT).not.toEqual(w.nodeWeightsT);
  });
  describe("toJSON/fromJSON", () => {
    it("works for the default weights", () => {
      const weights = emptyWeightsT();
      const json = toJSONWeightsT(weights);
      const jsonString = stringify(json, {space: 4});
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
      expect(weights).toEqual(fromJSON(json));
    });

    it("works for non-default weights", () => {
      const weights = emptyWeightsT();
      weights.nodeWeightsT.set(NodeAddress.empty, 32);
      weights.edgeWeightsT.set(EdgeAddress.empty, {
        forwards: 7,
        backwards: 9,
      });
      const json = toJSONWeightsT(weights);
      const jsonString = stringify(json, {space: 4});
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
      expect(weights).toEqual(fromJSON(json));
    });
  });

  describe("parser", () => {
    it("works for the 0_2_0 format", () => {
      const json: WeightsJSON_0_2_0 = toCompat(
        {type: "sourcecred/weights", version: "0.2.0"},
        {
          nodeWeightsT: {},
          edgeWeightsT: {},
        }
      );
      expect(parser.parseOrThrow(json)).toEqual(emptyWeightsT());
    });
  });

  describe("merge", () => {
    it("produces empty weights when given an empty array", () => {
      expect(mergeWeightsT([])).toEqual(emptyWeightsT());
    });
    it("produces empty weights when given empty weights", () => {
      expect(mergeWeightsT([emptyWeightsT(), emptyWeightsT()])).toEqual(
        emptyWeightsT()
      );
    });
    it("returns a copy when given only one weights", () => {
      const w = simpleWeightsT([["foo", 3]], [["bar", 2, 3]]);
      const wc = copyWeightsT(w);
      const merged = mergeWeightsT([w]);
      expect(merged).toEqual(wc);
      expect(merged).not.toBe(wc);
    });
    it("can merge two non-overlapping weights", () => {
      const w1 = simpleWeightsT([["foo", 3]], [["bar", 2, 3]]);
      const w2 = simpleWeightsT([["zod", 4]], [["zoink", 4, 5]]);
      const w3 = simpleWeightsT(
        [
          ["foo", 3],
          ["zod", 4],
        ],
        [
          ["bar", 2, 3],
          ["zoink", 4, 5],
        ]
      );
      const merged = mergeWeightsT([w1, w2]);
      expect(merged).toEqual(w3);
    });

    it("uses node resolvers propertly", () => {
      const w1 = simpleWeightsT(
        [
          ["miss", 100],
          ["hit", 100],
        ],
        []
      );
      const w2 = simpleWeightsT([["hit", 100]], []);
      const w3 = simpleWeightsT([["hit", 100]], []);
      const nodeResolver = (a, b) => a + b;
      const edgeResolver = (_unused_a, _unused_b) => {
        throw new Error("edge");
      };
      const resolvers = {nodeResolver, edgeResolver};
      const merged = mergeWeightsT([w1, w2, w3], resolvers);
      const expected = simpleWeightsT(
        [
          ["miss", 100],
          ["hit", 300],
        ],
        []
      );
      expect(expected).toEqual(merged);
    });

    it("gives the node address when a node resolver errors", () => {
      const w1 = simpleWeightsT([["hit", 100]], []);
      const w2 = simpleWeightsT([["hit", 100]], []);
      expect(() => mergeWeightsT([w1, w2])).toThrow(
        'when resolving NodeAddress["hit"]'
      );
    });

    it("gives the edge address when a edge resolver errors", () => {
      const w1 = simpleWeightsT([], [["hit", 3, 3]]);
      const w2 = simpleWeightsT([], [["hit", 3, 3]]);
      expect(() => mergeWeightsT([w1, w2])).toThrow(
        'when resolving EdgeAddress["hit"]'
      );
    });

    it("uses edge resolvers propertly", () => {
      const w1 = simpleWeightsT(
        [],
        [
          ["hit", 3, 3],
          ["miss", 3, 3],
        ]
      );
      const w2 = simpleWeightsT([], [["hit", 3, 3]]);
      const w3 = simpleWeightsT([], [["hit", 3, 3]]);
      const nodeResolver = (a, b) => a + b;
      const edgeResolver = (a, b) => ({
        forwards: a.forwards + b.forwards,
        backwards: a.backwards * b.backwards,
      });
      const merged = mergeWeightsT([w1, w2, w3], {nodeResolver, edgeResolver});
      const expected = simpleWeightsT(
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
        const w1 = simpleWeightsT([["foo", 3]], [["bar", 2, 3]]);
        const w2 = simpleWeightsT([["foo", 3]], [["bar", 2, 3]]);
        expect(() => mergeWeightsT([w1, w2])).toThrowError(
          "node weight conflict"
        );
      });
      it("errors on conflicting node weights", () => {
        const w1 = simpleWeightsT([["foo", 3]], []);
        const w2 = simpleWeightsT([["foo", 4]], []);
        expect(() => mergeWeightsT([w1, w2])).toThrowError(
          "node weight conflict"
        );
      });
      it("errors on conflicting edge weights (forwards)", () => {
        const w1 = simpleWeightsT([], [["foo", 3, 4]]);
        const w2 = simpleWeightsT([], [["foo", 4, 4]]);
        expect(() => mergeWeightsT([w1, w2])).toThrowError(
          "edge weight conflict"
        );
      });
      it("errors on conflicting edge weights (backwards)", () => {
        const w1 = simpleWeightsT([], [["foo", 4, 4]]);
        const w2 = simpleWeightsT([], [["foo", 4, 5]]);
        expect(() => mergeWeightsT([w1, w2])).toThrowError(
          "edge weight conflict"
        );
      });
    });
  });

  describe("compareWeightsT", () => {
    describe("simple weights are equal with no differences", () => {
      const w1 = simpleWeightsT(
        [
          ["foo", 3],
          ["zod", 4],
        ],
        [
          ["bar", 2, 3],
          ["zoink", 4, 5],
        ]
      );
      const w2 = simpleWeightsT(
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
          nodeWeightDiffs: [],
          edgeWeightDiffs: [],
        };
        expect(compareWeightsT(w1, w2)).toEqual(expected);
      });
    });

    describe("simple weights are equal but in different orders", () => {
      const w1 = simpleWeightsT(
        [
          ["zod", 4],
          ["foo", 3],
        ],
        [
          ["zoink", 4, 5],
          ["bar", 2, 3],
        ]
      );
      const w2 = simpleWeightsT(
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
          nodeWeightDiffs: [],
          edgeWeightDiffs: [],
        };
        expect(compareWeightsT(w1, w2)).toEqual(expected);
      });
    });

    describe("both weights have unique addresses", () => {
      const w1 = simpleWeightsT(
        [
          ["unique1", 3],
          ["zod", 4],
        ],
        [
          ["unique2", 2, 3],
          ["zoink", 4, 5],
        ]
      );
      const w2 = simpleWeightsT(
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
          nodeWeightDiffs: [
            {
              address: NodeAddress.fromParts(["unique1"]),
              first: 3,
              second: undefined,
            },
            {
              address: NodeAddress.fromParts(["unique3"]),
              first: undefined,
              second: 3,
            },
          ],
          edgeWeightDiffs: [
            {
              address: EdgeAddress.fromParts(["unique2"]),
              first: {forwards: 2, backwards: 3},
              second: undefined,
            },
            {
              address: EdgeAddress.fromParts(["unique4"]),
              first: undefined,
              second: {forwards: 2, backwards: 3},
            },
          ],
        };
        expect(compareWeightsT(w1, w2)).toEqual(expected);
      });
    });

    describe("weights have different values", () => {
      const w1 = simpleWeightsT(
        [
          ["foo", 3],
          ["zod", 6],
        ],
        [
          ["bar", 2, 3],
          ["zoink", 4, 5],
        ]
      );
      const w2 = simpleWeightsT(
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
          nodeWeightDiffs: [
            {address: NodeAddress.fromParts(["zod"]), first: 6, second: 4},
          ],
          edgeWeightDiffs: [
            {
              address: EdgeAddress.fromParts(["zoink"]),
              first: {forwards: 4, backwards: 5},
              second: {forwards: 5, backwards: 4},
            },
          ],
        };
        expect(compareWeightsT(w1, w2)).toEqual(expected);
      });
    });
  });
});
