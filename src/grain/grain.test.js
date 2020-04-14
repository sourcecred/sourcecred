// @flow

import {
  format,
  ONE,
  DECIMAL_PRECISION,
  ZERO,
  fromApproximateFloat,
  multiplyFloat,
} from "./grain";

describe("src/grain/grain", () => {
  describe("format", () => {
    // $ExpectFlowError
    const almostOne = ONE - 1n;

    it("correctly rounds to smallest integer when decimals==0", () => {
      expect(format(ZERO)).toEqual("0g");
      expect(format(fromApproximateFloat(0.1))).toEqual("0g");
      expect(format(almostOne)).toEqual("0g");
      expect(format(ONE)).toEqual("1g");
      expect(format(fromApproximateFloat(1.5))).toEqual("1g");
      expect(format(fromApproximateFloat(42))).toEqual("42g");
    });
    it("correctly adds comma formatting for large numbers", () => {
      expect(format(fromApproximateFloat(1337))).toEqual("1,337g");
      expect(format(fromApproximateFloat(1337), 1)).toEqual("1,337.0g");
      expect(format(fromApproximateFloat(1337.11))).toEqual("1,337g");
      expect(format(fromApproximateFloat(1337.11), 1)).toEqual("1,337.1g");
      expect(format(fromApproximateFloat(1337042.42), 0)).toEqual("1,337,042g");
      expect(format(fromApproximateFloat(1337042.42), 2)).toEqual(
        "1,337,042.42g"
      );
    });
    it("correctly handles negative numbers", () => {
      expect(format(fromApproximateFloat(-0.1))).toEqual("-0g");
      expect(format(fromApproximateFloat(-1.5))).toEqual("-1g");
      expect(format(fromApproximateFloat(-42))).toEqual("-42g");
      expect(format(fromApproximateFloat(-1.5), 1)).toEqual("-1.5g");
      expect(format(fromApproximateFloat(-1.5), 1)).toEqual("-1.5g");
      expect(format(fromApproximateFloat(-1337042.42), 0)).toEqual(
        "-1,337,042g"
      );
      expect(format(fromApproximateFloat(-1337042.42), 2)).toEqual(
        "-1,337,042.42g"
      );
    });
    it("handles full precision", () => {
      expect(format(ZERO, DECIMAL_PRECISION)).toEqual("0.000000000000000000g");
      expect(format(ONE, DECIMAL_PRECISION)).toEqual("1.000000000000000000g");
      expect(format(fromApproximateFloat(0.1), DECIMAL_PRECISION)).toEqual(
        "0.100000000000000000g"
      );
      // $ExpectFlowError
      expect(format(-12345n, DECIMAL_PRECISION)).toEqual(
        "-0.000000000000012345g"
      );
      // $ExpectFlowError
      expect(format((ONE / 100n) * 133704242n, DECIMAL_PRECISION)).toEqual(
        "1,337,042.420000000000000000g"
      );
    });
    it("supports alternative suffixes", () => {
      expect(format(fromApproximateFloat(1.5), 0, "SEEDS")).toEqual("1SEEDS");
      expect(format(fromApproximateFloat(42), 0, "SEEDS")).toEqual("42SEEDS");
      expect(format(fromApproximateFloat(-1.5), 1, "SEEDS")).toEqual(
        "-1.5SEEDS"
      );
      expect(format(fromApproximateFloat(-1337042.42), 0, "SEEDS")).toEqual(
        "-1,337,042SEEDS"
      );
    });
    it("throws an error if decimals is not an integer in range [0..decimalPrecision]", () => {
      const badValues = [
        -1,
        -0.5,
        0.33,
        DECIMAL_PRECISION + 1,
        Infinity,
        -Infinity,
        NaN,
      ];
      for (const bad of badValues) {
        expect(() => format(ONE, bad)).toThrowError("must be integer in range");
      }
    });
  });

  describe("multiplyFloat", () => {
    it("behaves reasonably for tiny grain values", () => {
      // $ExpectFlowError
      expect(multiplyFloat(1n, 5)).toEqual(5n);
    });
    it("behaves reasonably for larger grain values", () => {
      // $ExpectFlowError
      expect(multiplyFloat(ONE, 2)).toEqual(2n * ONE);
    });
    it("has small error on large grain values", () => {
      // To compare with arbitrary precision results, see:
      // https://observablehq.com/@decentralion/grain-arithmetic

      // Within 1 attoGrain of "true" value
      // $ExpectFlowError
      expect(multiplyFloat(ONE, 1 / 1337)).toEqual(747943156320119n);

      // Within 300 attoGrain of "true" value
      // $ExpectFlowError
      expect(multiplyFloat(ONE, Math.PI)).toEqual(3141592653589793280n);
    });
  });
  describe("fromApproximateFloat", () => {
    it("fromApproximateFloat(1) === ONE", () => {
      expect(fromApproximateFloat(1)).toEqual(ONE);
    });
    it("fromApproximateFloat(0.1) === ONE / 10", () => {
      // $ExpectFlowError
      expect(fromApproximateFloat(0.1)).toEqual(ONE / 10n);
    });
  });
});
