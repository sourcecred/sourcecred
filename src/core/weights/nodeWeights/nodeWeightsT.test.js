// @flow

import {type NodeWeightsT, empty, copy, merge} from "./nodeWeightsT";
import {NodeAddress} from "../../graph";

export function simpleNodeWeightsT(
  nodeWeightsT: [string, number][]
): NodeWeightsT {
  const nw = empty();
  for (const [addrPart, weight] of nodeWeightsT) {
    nw.set(NodeAddress.fromParts([addrPart]), weight);
  }
  return nw;
}

describe("core/weights/nodeWeights/nodeWeightsT", () => {
  it("copy makes a copy", () => {
    const nwt = empty();
    const nwt1 = copy(nwt);
    nwt1.set(NodeAddress.empty, 33);
    nwt1.set(NodeAddress.empty, 35);
    expect(nwt1).not.toEqual(nwt);
    expect(nwt1).not.toEqual(nwt);
    expect(nwt1).not.toEqual(nwt);
    expect(nwt1).not.toEqual(nwt);
  });

  describe("merge", () => {
    it("produces empty weights when given an empty array", () => {
      expect(merge([])).toEqual(empty());
    });
    it("produces empty weights when given empty weights", () => {
      expect(merge([empty(), empty()])).toEqual(empty());
    });
    it("returns a copy when given only one weights", () => {
      const nwt = simpleNodeWeightsT([["foo", 3]]);
      const wc = copy(nwt);
      const merged = merge([nwt]);
      expect(merged).toEqual(wc);
      expect(merged).not.toBe(wc);
    });
    it("can merge two non-overlapping weights", () => {
      const nwt1 = simpleNodeWeightsT([["foo", 3]]);
      const nwt2 = simpleNodeWeightsT([["zod", 4]]);
      const nwt3 = simpleNodeWeightsT([
        ["foo", 3],
        ["zod", 4],
      ]);
      const merged = merge([nwt1, nwt2]);
      expect(merged).toEqual(nwt3);
    });

    it("uses node resolvers propertly", () => {
      const nwt1 = simpleNodeWeightsT([
        ["miss", 100],
        ["hit", 100],
      ]);
      const nwt2 = simpleNodeWeightsT([["hit", 100]]);
      const nwt3 = simpleNodeWeightsT([["hit", 100]]);
      const nodeResolver = (a, b) => a + b;
      const merged = merge([nwt1, nwt2, nwt3], nodeResolver);
      const expected = simpleNodeWeightsT([
        ["miss", 100],
        ["hit", 300],
      ]);
      expect(expected).toEqual(merged);
    });

    it("gives the node address when a node resolver errors", () => {
      const nwt1 = simpleNodeWeightsT([["hit", 100]]);
      const nwt2 = simpleNodeWeightsT([["hit", 100]]);
      expect(() => merge([nwt1, nwt2])).toThrow(
        'when resolving NodeAddress["hit"]'
      );
    });

    describe("when no resolvers are provided", () => {
      it("throws an error on overlapping weights with no conflicts", () => {
        const nwt1 = simpleNodeWeightsT([["foo", 3]]);
        const nwt2 = simpleNodeWeightsT([["foo", 3]]);
        expect(() => merge([nwt1, nwt2])).toThrowError("node weight conflict");
      });
      it("errors on conflicting node weights", () => {
        const nwt1 = simpleNodeWeightsT([["foo", 3]]);
        const nwt2 = simpleNodeWeightsT([["foo", 4]]);
        expect(() => merge([nwt1, nwt2])).toThrowError("node weight conflict");
      });
    });
  });
});
