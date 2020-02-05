// @flow

import {uniformDistribution, computeDelta} from "./distribution";

describe("core/algorithm/distribution", () => {
  describe("uniformDistribution", () => {
    describe("errors for: ", () => {
      [
        [NaN, "NaN"],
        [-1, "negatives"],
        [0, "zero"],
        [1.337, "non-integer"],
      ].forEach(([value, name]) => {
        it(name, () => {
          expect(() => uniformDistribution(value)).toThrowError(
            "expected positive integer"
          );
        });
      });
    });
    it("returns a uniform distribution of size 1", () => {
      expect(uniformDistribution(1)).toEqual(new Float64Array([1]));
    });
    it("returns a uniform distribution of size 2", () => {
      expect(uniformDistribution(2)).toEqual(new Float64Array([0.5, 0.5]));
    });
  });

  describe("computeDelta", () => {
    const u = uniformDistribution;
    it("errors on empty array", () => {
      expect(() =>
        computeDelta(new Float64Array([]), new Float64Array([]))
      ).toThrowError("invalid input");
    });
    it("works on size-1 array", () => {
      expect(computeDelta(u(1), u(1))).toEqual(0);
    });
    it("errors on mismatched sizes", () => {
      expect(() => computeDelta(u(1), u(2))).toThrowError("invalid input");
    });
    it("correctly computes max delta", () => {
      const pi = new Float64Array([0.5, 0.0, 0.5]);
      expect(computeDelta(u(3), pi)).toEqual(1 / 3);
    });
    it("doesn't depend on argument order", () => {
      // implies that it uses Math.abs for delta computation
      const pi = new Float64Array([0.5, 0.0, 0.5]);
      expect(computeDelta(u(3), pi)).toEqual(computeDelta(pi, u(3)));
    });
  });
});
