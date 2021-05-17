// @flow

import {NodeAddress} from "../../core/graph";
import {
  weightedDistribution,
  distributionToNodeDistribution,
} from "./nodeDistribution";

describe("core/algorithm/nodeDistribution", () => {
  const n1 = NodeAddress.fromParts(["n1"]);
  const n2 = NodeAddress.fromParts(["n2"]);

  describe("distributionToNodeDistribution", () => {
    it("works", () => {
      const pi = new Float64Array([0.25, 0.75]);
      expect(distributionToNodeDistribution([n1, n2], pi)).toEqual(
        new Map().set(n1, 0.25).set(n2, 0.75)
      );
    });
  });

  describe("weightedDistribution", () => {
    const a = NodeAddress.fromParts(["a"]);
    const b = NodeAddress.fromParts(["b"]);
    const c = NodeAddress.fromParts(["c"]);
    const d = NodeAddress.fromParts(["d"]);
    const order = () => [a, b, c, d];
    it("gives a uniform distribution for an empty map", () => {
      expect(weightedDistribution(order(), new Map())).toEqual(
        new Float64Array([0.25, 0.25, 0.25, 0.25])
      );
    });
    it("gives a uniform distribution for a map with 0 weight", () => {
      const map = new Map().set(a, 0);
      expect(weightedDistribution(order(), map)).toEqual(
        new Float64Array([0.25, 0.25, 0.25, 0.25])
      );
    });
    it("can put all weight on one node", () => {
      const map = new Map().set(b, 0.1);
      expect(weightedDistribution(order(), map)).toEqual(
        new Float64Array([0, 1, 0, 0])
      );
    });
    it("can split weight unequally", () => {
      const map = new Map().set(b, 1).set(c, 3);
      expect(weightedDistribution(order(), map)).toEqual(
        new Float64Array([0, 0.25, 0.75, 0])
      );
    });
    it("can create a uniform distribution if all weights are equal", () => {
      const map = new Map().set(a, 1).set(b, 1).set(c, 1).set(d, 1);
      expect(weightedDistribution(order(), map)).toEqual(
        new Float64Array([0.25, 0.25, 0.25, 0.25])
      );
    });
    describe("errors if", () => {
      it("has a weighted node that is not in the order", () => {
        const z = NodeAddress.fromParts(["z"]);
        const map = new Map().set(z, 1);
        expect(() => weightedDistribution(order(), map)).toThrowError(
          "weights included nodes not present in the nodeOrder"
        );
      });
      it("has a node with negative weight", () => {
        const map = new Map().set(a, -1);
        expect(() => weightedDistribution(order(), map)).toThrowError(
          "Invalid weight -1"
        );
      });
      it("has a node with NaN weight", () => {
        const map = new Map().set(a, NaN);
        expect(() => weightedDistribution(order(), map)).toThrowError(
          "Invalid weight NaN"
        );
      });
      it("has a node with infinite weight", () => {
        const map = new Map().set(a, Infinity);
        expect(() => weightedDistribution(order(), map)).toThrowError(
          "Invalid weight Infinity"
        );
      });
    });
  });
});
