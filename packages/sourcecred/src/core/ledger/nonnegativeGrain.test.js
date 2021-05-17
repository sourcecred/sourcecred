// @flow

import {fromGrain, fromInteger, fromString} from "./nonnegativeGrain";
import {ONE, type Grain} from "./grain";
import {g} from "./testUtils";

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
});
