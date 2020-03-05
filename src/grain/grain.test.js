// @flow

import {format, one, decimalPrecision, zero} from "./grain";

describe("src/grain/grain", () => {
  describe("format", () => {
    // $ExpectFlowError
    const pointOne = one / 10n;
    // $ExpectFlowError
    const onePointFive = pointOne * 15n;
    // $ExpectFlowError
    const almostOne = one - 1n;
    // $ExpectFlowError
    const fortyTwo = one * 42n;
    // $ExpectFlowError
    const negative = -1n;
    // $ExpectFlowError
    const leet = one * 1337n;
    // $ExpectFlowError
    const leetAndSpecial = leet * 1000n + fortyTwo + fortyTwo / 100n;

    it("correctly rounds to smallest integer when decimals==0", () => {
      expect(format(zero)).toEqual("0g");
      expect(format(pointOne)).toEqual("0g");
      expect(format(almostOne)).toEqual("0g");
      expect(format(one)).toEqual("1g");
      expect(format(onePointFive)).toEqual("1g");
      expect(format(fortyTwo)).toEqual("42g");
    });
    it("correctly adds comma formatting for large numbers", () => {
      expect(format(leet)).toEqual("1,337g");
      expect(format(leet, 1)).toEqual("1,337.0g");
      expect(format(leet + pointOne)).toEqual("1,337g");
      expect(format(leet + pointOne, 1)).toEqual("1,337.1g");
      expect(format(leetAndSpecial, 0)).toEqual("1,337,042g");
      expect(format(leetAndSpecial, 2)).toEqual("1,337,042.42g");
    });
    it("correctly handles negative numbers", () => {
      expect(format(negative * pointOne)).toEqual("-0g");
      expect(format(negative * onePointFive)).toEqual("-1g");
      expect(format(negative * fortyTwo)).toEqual("-42g");
      expect(format(negative * onePointFive, 1)).toEqual("-1.5g");
      expect(format(negative * onePointFive, 1)).toEqual("-1.5g");
      expect(format(negative * leetAndSpecial, 0)).toEqual("-1,337,042g");
      expect(format(negative * leetAndSpecial, 2)).toEqual("-1,337,042.42g");
    });
    it("handles full precision", () => {
      expect(format(zero, decimalPrecision)).toEqual("0.000000000000000000g");
      expect(format(one, decimalPrecision)).toEqual("1.000000000000000000g");
      expect(format(pointOne, decimalPrecision)).toEqual(
        "0.100000000000000000g"
      );
      // $ExpectFlowError
      expect(format(-12345n, decimalPrecision)).toEqual(
        "-0.000000000000012345g"
      );
      expect(format(leetAndSpecial, decimalPrecision)).toEqual(
        "1,337,042.420000000000000000g"
      );
    });
    it("supports alternative suffixes", () => {
      expect(format(onePointFive, 0, "SEEDS")).toEqual("1SEEDS");
      expect(format(fortyTwo, 0, "SEEDS")).toEqual("42SEEDS");
      expect(format(negative * onePointFive, 1, "SEEDS")).toEqual("-1.5SEEDS");
      expect(format(negative * leetAndSpecial, 0, "SEEDS")).toEqual(
        "-1,337,042SEEDS"
      );
    });
    it("throws an error if decimals is not an integer in range [0..decimalPrecision]", () => {
      const badValues = [
        -1,
        -0.5,
        0.33,
        decimalPrecision + 1,
        Infinity,
        -Infinity,
        NaN,
      ];
      for (const bad of badValues) {
        expect(() => format(one, bad)).toThrowError("must be integer in range");
      }
    });
  });
});
