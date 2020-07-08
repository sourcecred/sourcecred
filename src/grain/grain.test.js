// @flow

import * as G from "./grain";

describe("src/grain/grain", () => {
  describe("G.format", () => {
    const almostOne = G.sub(G.ONE, G.fromString("1"));

    it("correctly rounds to smallest integer when decimals==0", () => {
      expect(G.format(G.ZERO)).toEqual("0g");
      expect(G.format(G.fromApproximateFloat(0.1))).toEqual("0g");
      expect(G.format(almostOne)).toEqual("0g");
      expect(G.format(G.ONE)).toEqual("1g");
      expect(G.format(G.fromApproximateFloat(1.5))).toEqual("1g");
      expect(G.format(G.fromApproximateFloat(42))).toEqual("42g");
    });
    it("correctly G.adds comma G.formatting for large numbers", () => {
      expect(G.format(G.fromApproximateFloat(1337))).toEqual("1,337g");
      expect(G.format(G.fromApproximateFloat(1337), 1)).toEqual("1,337.0g");
      expect(G.format(G.fromApproximateFloat(1337.11))).toEqual("1,337g");
      expect(G.format(G.fromApproximateFloat(1337.11), 1)).toEqual("1,337.1g");
      expect(G.format(G.fromApproximateFloat(1337042.42), 0)).toEqual(
        "1,337,042g"
      );
      expect(G.format(G.fromApproximateFloat(1337042.42), 2)).toEqual(
        "1,337,042.42g"
      );
    });
    it("correctly handles negative numbers", () => {
      expect(G.format(G.fromApproximateFloat(-0.1))).toEqual("-0g");
      expect(G.format(G.fromApproximateFloat(-1.5))).toEqual("-1g");
      expect(G.format(G.fromApproximateFloat(-42))).toEqual("-42g");
      expect(G.format(G.fromApproximateFloat(-1.5), 1)).toEqual("-1.5g");
      expect(G.format(G.fromApproximateFloat(-1.5), 1)).toEqual("-1.5g");
      expect(G.format(G.fromApproximateFloat(-1337042.42), 0)).toEqual(
        "-1,337,042g"
      );
      expect(G.format(G.fromApproximateFloat(-1337042.42), 2)).toEqual(
        "-1,337,042.42g"
      );
    });
    it("handles full precision", () => {
      expect(G.format(G.ZERO, G.DECIMAL_PRECISION)).toEqual(
        "0.000000000000000000g"
      );
      expect(G.format(G.ONE, G.DECIMAL_PRECISION)).toEqual(
        "1.000000000000000000g"
      );
      expect(
        G.format(G.fromApproximateFloat(0.1), G.DECIMAL_PRECISION)
      ).toEqual("0.100000000000000000g");
      expect(G.format(G.fromString("-12345"), G.DECIMAL_PRECISION)).toEqual(
        "-0.000000000000012345g"
      );
      const v = G.mul(G.fromApproximateFloat(0.01), G.fromString("133704242"));
      expect(G.format(v, G.DECIMAL_PRECISION)).toEqual(
        "1,337,042.420000000000000000g"
      );
    });
    it("supports alternative suffixes", () => {
      expect(G.format(G.fromApproximateFloat(1.5), 0, "SEEDS")).toEqual(
        "1SEEDS"
      );
      expect(G.format(G.fromApproximateFloat(42), 0, "SEEDS")).toEqual(
        "42SEEDS"
      );
      expect(G.format(G.fromApproximateFloat(-1.5), 1, "SEEDS")).toEqual(
        "-1.5SEEDS"
      );
      expect(G.format(G.fromApproximateFloat(-1337042.42), 0, "SEEDS")).toEqual(
        "-1,337,042SEEDS"
      );
    });
    it("throws an error if decimals is not an integer in range [0..decimalPrecision]", () => {
      const badValues = [
        -1,
        -0.5,
        0.33,
        G.DECIMAL_PRECISION + 1,
        Infinity,
        -Infinity,
        NaN,
      ];
      for (const bad of badValues) {
        expect(() => G.format(G.ONE, bad)).toThrowError(
          "must be integer in range"
        );
      }
    });
  });

  describe("conversion from strings", () => {
    it("fromString works on valid Grain values", () => {
      expect(G.fromString(G.ONE)).toEqual(G.ONE);
    });
    it("fromString errors on invalid Grain values", () => {
      expect(() => G.fromString("123.4")).toThrowError(
        "Cannot convert 123.4 to a BigInt"
      );
    });
  });

  describe("G.multiplyFloat", () => {
    it("behaves reasonably for tiny grain values", () => {
      expect(G.multiplyFloat(G.fromString("1"), 5)).toEqual(G.fromString("5"));
    });
    it("behaves reasonably for larger grain values", () => {
      expect(G.multiplyFloat(G.ONE, 2)).toEqual(
        G.mul(G.fromString("2"), G.ONE)
      );
    });
    it("has small error on large grain values", () => {
      // To compare with arbitrary precision results, see:
      // https://observablehq.com/@decentralion/grain-arithmetic

      // Within 1 attoGrain of "true" value
      expect(G.multiplyFloat(G.ONE, 1 / 1337)).toEqual(
        G.fromString("747943156320119")
      );

      // Within 300 attoGrain of "true" value
      expect(G.multiplyFloat(G.ONE, Math.PI)).toEqual(
        G.fromString("3141592653589793280")
      );
    });
  });
  describe("G.fromApproximateFloat", () => {
    it("G.fromApproximateFloat(1) === G.ONE", () => {
      expect(G.fromApproximateFloat(1)).toEqual(G.ONE);
    });
    it("G.fromApproximateFloat(0.1) === G.ONE / 10", () => {
      const tenth = G.div(G.ONE, G.fromString("10"));
      expect(G.fromApproximateFloat(0.1)).toEqual(tenth);
    });
  });

  describe("toFloatRatio", () => {
    const two = G.mul(G.ONE, G.fromString("2"));
    const three = G.mul(G.ONE, G.fromString("3"));
    const five = G.mul(G.ONE, G.fromString("5"));
    it("handles a one-to-one ratio", () => {
      expect(G.toFloatRatio(G.ONE, G.ONE)).toEqual(1);
    });
    it("handles a larger numerator", () => {
      expect(G.toFloatRatio(two, G.ONE)).toEqual(2);
    });
    it("handles fractional numbers", () => {
      expect(G.toFloatRatio(five, two)).toEqual(2.5);
    });
    it("calculates repeating decimal ratios", () => {
      expect(G.toFloatRatio(five, three)).toEqual(5 / 3);
    });
    it("approximates correctly when Grain values are not exactly equal", () => {
      const almostOne = G.sub(G.ONE, G.fromString("1"));
      expect(G.toFloatRatio(G.ONE, almostOne)).toEqual(1);
    });
    it("handles irrational numbers", () => {
      const bigPi = G.multiplyFloat(G.ONE, Math.PI);
      expect(G.toFloatRatio(bigPi, two)).toEqual(Math.PI / 2);
    });
  });
});
