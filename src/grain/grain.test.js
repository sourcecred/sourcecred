// @flow

import {format} from "./grain";

describe("src/grain/grain", () => {
  describe("format", () => {
    // $ExpectFlowError
    const pointOne = 10n ** 17n;
    // $ExpectFlowError
    const one = pointOne * 10n;
    // $ExpectFlowError
    const onePointFive = pointOne * 15n;
    // $ExpectFlowError
    const almostOne = one - 1n;
    // $ExpectFlowError
    const fortyTwo = one * 42n;
    it("works at 0 decimals precision (and rounds down)", () => {
      expect(format(pointOne)).toEqual("0");
      expect(format(almostOne)).toEqual("0");
      expect(format(one)).toEqual("1");
      expect(format(onePointFive)).toEqual("1");
      expect(format(fortyTwo)).toEqual("42");
    });
    it("works at 1 decimals precision (and rounds down)", () => {
      expect(format(pointOne, 1)).toEqual("0.1");
      expect(format(almostOne, 1)).toEqual("0.9");
      expect(format(one, 1)).toEqual("1.0");
      expect(format(onePointFive, 1)).toEqual("1.5");
      expect(format(fortyTwo, 1)).toEqual("42.0");
    });
    it("works at 2 decimals precision (and rounds down)", () => {
      expect(format(pointOne, 2)).toEqual("0.10");
      expect(format(almostOne, 2)).toEqual("0.99");
      expect(format(one, 2)).toEqual("1.00");
      expect(format(onePointFive, 2)).toEqual("1.50");
      expect(format(fortyTwo, 2)).toEqual("42.00");
    });
    it("works at 18 decimals precision", () => {
      expect(format(pointOne, 18)).toEqual("0.100000000000000000");
      expect(format(almostOne, 18)).toEqual("0.999999999999999999");
      expect(format(one, 18)).toEqual("1.000000000000000000");
      expect(format(onePointFive, 18)).toEqual("1.500000000000000000");
      expect(format(fortyTwo, 18)).toEqual("42.000000000000000000");
    });
    it("throws an error if decimals is not an integer in range [0..18]", () => {
      const badValues = [-1, -0.5, 0.33, 19, Infinity, -Infinity, NaN];
      for (const bad of badValues) {
        expect(() => format(one, bad)).toThrowError("must be integer in range");
      }
    });
  });
});
