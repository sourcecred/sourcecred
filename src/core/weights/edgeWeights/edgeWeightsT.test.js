// @flow

import {type EdgeWeightsT, empty, copy, merge} from "./edgeWeightsT";
import {EdgeAddress} from "../../graph";

export function simpleEdgeWeightsT(
  edgeWeightsT: [string, number, number][]
): EdgeWeightsT {
  const ewt = empty();
  for (const [addrPart, forwards, backwards] of edgeWeightsT) {
    const weight = {forwards, backwards};
    ewt.set(EdgeAddress.fromParts([addrPart]), weight);
  }
  return ewt;
}

describe("core/weights/edgeWeights/edgeWeightsT", () => {
  it("copy makes a copy", () => {
    const ewt = empty();
    const ewt1 = copy(ewt);
    ewt1.set(EdgeAddress.empty, {forwards: 34, backwards: 39});
    expect(ewt1).not.toEqual(ewt);
    expect(ewt1).not.toEqual(ewt);
  });

  describe("merge", () => {
    it("produces empty weights when given an empty array", () => {
      expect(merge([])).toEqual(empty());
    });
    it("produces empty weights when given empty weights", () => {
      expect(merge([empty(), empty()])).toEqual(empty());
    });
    it("returns a copy when given only one weights", () => {
      const ewt = simpleEdgeWeightsT([["bar", 2, 3]]);
      const wc = copy(ewt);
      const merged = merge([ewt]);
      expect(merged).toEqual(wc);
      expect(merged).not.toBe(wc);
    });
    it("can merge two non-overlapping weights", () => {
      const ewt1 = simpleEdgeWeightsT([["bar", 2, 3]]);
      const ewt2 = simpleEdgeWeightsT([["zoink", 4, 5]]);
      const ewt3 = simpleEdgeWeightsT([
        ["bar", 2, 3],
        ["zoink", 4, 5],
      ]);
      const merged = merge([ewt1, ewt2]);
      expect(merged).toEqual(ewt3);
    });

    it("gives the edge address when a edge resolver errors", () => {
      const ewt1 = simpleEdgeWeightsT([["hit", 3, 3]]);
      const ewt2 = simpleEdgeWeightsT([["hit", 3, 3]]);
      expect(() => merge([ewt1, ewt2])).toThrow(
        'when resolving EdgeAddress["hit"]'
      );
    });

    it("uses edge resolvers propertly", () => {
      const ewt1 = simpleEdgeWeightsT([
        ["hit", 3, 3],
        ["miss", 3, 3],
      ]);
      const ewt2 = simpleEdgeWeightsT([["hit", 3, 3]]);
      const ewt3 = simpleEdgeWeightsT([["hit", 3, 3]]);
      const edgeResolver = (a, b) => ({
        forwards: a.forwards + b.forwards,
        backwards: a.backwards * b.backwards,
      });
      const merged = merge([ewt1, ewt2, ewt3], edgeResolver);
      const expected = simpleEdgeWeightsT([
        ["hit", 9, 27],
        ["miss", 3, 3],
      ]);
      expect(expected).toEqual(merged);
    });

    describe("when no resolvers are provided", () => {
      it("throws an error on overlapping weights with no conflicts", () => {
        const ewt1 = simpleEdgeWeightsT([["bar", 2, 3]]);
        const ewt2 = simpleEdgeWeightsT([["bar", 2, 3]]);
        expect(() => merge([ewt1, ewt2])).toThrowError("edge weight conflict");
      });

      it("errors on conflicting edge weights (forwards)", () => {
        const ewt1 = simpleEdgeWeightsT([["foo", 3, 4]]);
        const ewt2 = simpleEdgeWeightsT([["foo", 4, 4]]);
        expect(() => merge([ewt1, ewt2])).toThrowError("edge weight conflict");
      });
      it("errors on conflicting edge weights (backwards)", () => {
        const ewt1 = simpleEdgeWeightsT([["foo", 4, 4]]);
        const ewt2 = simpleEdgeWeightsT([["foo", 4, 5]]);
        expect(() => merge([ewt1, ewt2])).toThrowError("edge weight conflict");
      });
    });
  });
});
