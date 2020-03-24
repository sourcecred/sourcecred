// @flow

import {
  format,
  ONE,
  DECIMAL_PRECISION,
  ZERO,
  fromFloat,
  multiplyFloat,
} from "./grain";

describe("src/grain/grain", () => {
  describe("format", () => {
    // $ExpectFlowError
    const almostOne = ONE - 1n;

    it("correctly rounds to smallest integer when decimals==0", () => {
      expect(format(ZERO)).toEqual("0g");
      expect(format(fromFloat(0.1))).toEqual("0g");
      expect(format(almostOne)).toEqual("0g");
      expect(format(ONE)).toEqual("1g");
      expect(format(fromFloat(1.5))).toEqual("1g");
      expect(format(fromFloat(42))).toEqual("42g");
    });
    it("correctly adds comma formatting for large numbers", () => {
      expect(format(fromFloat(1337))).toEqual("1,337g");
      expect(format(fromFloat(1337), 1)).toEqual("1,337.0g");
      expect(format(fromFloat(1337.11))).toEqual("1,337g");
      expect(format(fromFloat(1337.11), 1)).toEqual("1,337.1g");
      expect(format(fromFloat(1337042.42), 0)).toEqual("1,337,042g");
      expect(format(fromFloat(1337042.42), 2)).toEqual("1,337,042.42g");
    });
    it("correctly handles negative numbers", () => {
      expect(format(fromFloat(-0.1))).toEqual("-0g");
      expect(format(fromFloat(-1.5))).toEqual("-1g");
      expect(format(fromFloat(-42))).toEqual("-42g");
      expect(format(fromFloat(-1.5), 1)).toEqual("-1.5g");
      expect(format(fromFloat(-1.5), 1)).toEqual("-1.5g");
      expect(format(fromFloat(-1337042.42), 0)).toEqual("-1,337,042g");
      expect(format(fromFloat(-1337042.42), 2)).toEqual("-1,337,042.42g");
    });
    it("handles full precision", () => {
      expect(format(ZERO, DECIMAL_PRECISION)).toEqual("0.000000000000000000g");
      expect(format(ONE, DECIMAL_PRECISION)).toEqual("1.000000000000000000g");
      expect(format(fromFloat(0.1), DECIMAL_PRECISION)).toEqual(
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
      expect(format(fromFloat(1.5), 0, "SEEDS")).toEqual("1SEEDS");
      expect(format(fromFloat(42), 0, "SEEDS")).toEqual("42SEEDS");
      expect(format(fromFloat(-1.5), 1, "SEEDS")).toEqual("-1.5SEEDS");
      expect(format(fromFloat(-1337042.42), 0, "SEEDS")).toEqual(
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
    describe("has small error on large grain values", () => {
      // To compare with arbitrary precision results, see:
      // https://observablehq.com/@decentralion/grain-arithmetic

      // To generate expected values:
      //
      // ```python
      // input = 1.0 / 1337
      // (p, q) = input.as_integer_ratio()
      // floored = (p * (10 ** 18)) // q
      // rounded = (p * (10 ** 18) * 2 + q) // (2 * q)
      // print(floored)
      // print(rounded)
      // ```
      function check({input, expected, tolerance}) {
        const actual = multiplyFloat(ONE, input);
        expect(actual).toBeGreaterThanOrEqual(expected - tolerance);
        expect(actual).toBeLessThanOrEqual(expected + tolerance);
      }
      it("on 1 / 1337", () => {
        check({
          input: 1 / 1337,
          // $ExpectFlowError
          expected: 747943156320120n,
          // $ExpectFlowError
          tolerance: 1000n,
        });
      });
      it("on Math.PI", () => {
        check({
          input: Math.PI,
          // $ExpectFlowError
          expected: 3141592653589793116n,
          // $ExpectFlowError
          tolerance: 300000n,
        });
      });
    });
  });
  describe("fromFloat", () => {
    it("fromFloat(1) === ONE", () => {
      expect(fromFloat(1)).toEqual(ONE);
    });
    it("fromFloat(0.5) === ONE / 2", () => {
      // $ExpectFlowError
      expect(fromFloat(0.5)).toEqual(ONE / 2n);
    });
  });
});
