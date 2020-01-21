// @flow

import stringify from "json-stable-stringify";
import {NodeAddress, EdgeAddress} from "../core/graph";
import {type Weights as WeightsT} from "./weights";
import * as Weights from "./weights";

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
    it("can merge overlapping weights with no conflicts", () => {
      const w1 = simpleWeights([["foo", 3]], [["bar", 2, 3]]);
      const w2 = simpleWeights([["foo", 3]], [["bar", 2, 3]]);
      const merged = Weights.merge([w1, w2]);
      expect(merged).toEqual(w1);
    });
    it("errors on conflicting node weights", () => {
      const w1 = simpleWeights([["foo", 3]], []);
      const w2 = simpleWeights([["foo", 4]], []);
      expect(() => Weights.merge([w1, w2])).toThrowError(
        "inconsistent weights"
      );
    });
    it("errors on conflicting edge weights (forwards)", () => {
      const w1 = simpleWeights([], [["foo", 3, 4]]);
      const w2 = simpleWeights([], [["foo", 4, 4]]);
      expect(() => Weights.merge([w1, w2])).toThrowError(
        "inconsistent weights"
      );
    });
    it("errors on conflicting edge weights (backwards)", () => {
      const w1 = simpleWeights([], [["foo", 4, 4]]);
      const w2 = simpleWeights([], [["foo", 4, 5]]);
      expect(() => Weights.merge([w1, w2])).toThrowError(
        "inconsistent weights"
      );
    });
  });
  describe("equals", () => {
    it("empty weights are equal to empty weights", () => {
      expect(Weights.equals(Weights.empty(), Weights.empty())).toBe(true);
    });
    it("non-empty weights are equal to their copies", () => {
      const w1 = simpleWeights([["foo", 2]], [["bar", 2, 3]]);
      const w2 = Weights.copy(w1);
      expect(Weights.equals(w1, w2)).toBe(true);
    });
    it("weights with distinct node weights are not equal", () => {
      const w1 = simpleWeights([["foo", 1]], []);
      const w2 = simpleWeights([["foo", 2]], []);
      expect(Weights.equals(w1, w2)).toBe(false);
    });
    it("weights with distinct nodes are not equal", () => {
      const w1 = simpleWeights([], [["foo", 1, 2]]);
      const w2 = simpleWeights([], [["foo", 2, 2]]);
      expect(Weights.equals(w1, w2)).toBe(false);
    });
  });
});
