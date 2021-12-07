// @flow

import {
  fromGrain,
  fromInteger,
  fromString,
  numberOrFloatStringParser,
} from "./nonnegativeGrain";
import {ONE, type Grain} from "./grain";
import {g} from "./testUtils";
import dedent from "../../util/dedent";

describe("core/ledger/nonnegativeGrain", () => {
  describe("fromGrain", () => {
    it("fromGrain works on valid Grain values", () => {
      expect(fromGrain(ONE)).toEqual(ONE);
    });
    it("errors on -1", () => {
      const negativeOne: Grain = g("-1");
      expect(() => fromGrain(negativeOne)).toThrowError(
        "Grain amount must be nonnegative"
      );
    });
  });

  describe("fromString", () => {
    it("fromString works on valid Grain values", () => {
      expect(fromString(ONE)).toEqual(ONE);
    });
    it("fromString errors on invalid Grain values", () => {
      expect(() => fromString("123.4")).toThrowError("Invalid integer: 123.4");
    });
    it("errors on -1", () => {
      expect(() => fromString("-1")).toThrowError(
        "Grain amount must be nonnegative"
      );
    });
  });

  describe("fromInteger", () => {
    it("works on 0", () => {
      expect(fromInteger(0)).toEqual("0");
    });
    it("works on 1", () => {
      expect(fromInteger(1)).toEqual(ONE);
    });
    it("works on 3", () => {
      expect(fromInteger(3)).toEqual("3000000000000000000");
    });
    it("errors on -1", () => {
      expect(() => fromInteger(-1)).toThrowError(
        "Grain amount must be nonnegative"
      );
    });
    it("errors for non-integers", () => {
      for (const bad of [1.2, NaN, Infinity, -Infinity]) {
        const thunk = () => fromInteger(bad);
        expect(thunk).toThrowError(`not an integer: ${bad}`);
      }
    });
  });

  describe("numberOrFloatStringParser", () => {
    it("works on 0", () => {
      expect(numberOrFloatStringParser.parse(0)).toEqual({
        ok: true,
        value: "0",
      });
    });
    it("works on 1", () => {
      expect(numberOrFloatStringParser.parse(1)).toEqual({
        ok: true,
        value: ONE,
      });
    });
    it("works on 3", () => {
      expect(numberOrFloatStringParser.parse(3)).toEqual({
        ok: true,
        value: "3000000000000000000",
      });
    });
    it("works on '3.5' (string)", () => {
      expect(numberOrFloatStringParser.parse("3.5")).toEqual({
        ok: true,
        value: "3500000000000000000",
      });
    });
    it("fails on 3.5 (number)", () => {
      expect(numberOrFloatStringParser.parse(3.5)).toEqual({
        ok: false,
        err: dedent`\
              orElse Parser: no parse matched: [
                  "expected integer, got number",
                  "expected string, got number"
              ]`,
      });
    });
  });
});
