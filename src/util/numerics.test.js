// @flow

import * as N from "./numerics";

describe("util/numerics", () => {
  describe("finite", () => {
    it("allows finite numbers", () => {
      for (const f of [-1.2, 0, 999]) {
        expect(N.finite(f)).toEqual(f);
        expect(N.finiteParser.parseOrThrow(f)).toEqual(f);
      }
    });
    it("disallows non-finite numbers", () => {
      for (const f of [NaN, Infinity, -Infinity]) {
        expect(() => N.finite(f)).toThrow("expected finite, got:");
        expect(() => N.finiteParser.parseOrThrow(f)).toThrow(
          "expected finite, got:"
        );
      }
    });
  });
  describe("finiteNonnegative", () => {
    it("allows finite nonnegative numbers", () => {
      for (const f of [0, 0.12, 999]) {
        expect(N.finite(f)).toEqual(f);
        expect(N.finiteParser.parseOrThrow(f)).toEqual(f);
      }
    });
    it("disallows non-finite or negative numbers", () => {
      for (const f of [NaN, Infinity, -Infinity, -3, -0.12]) {
        expect(() => N.finiteNonnegative(f)).toThrow(
          "expected finite nonnegative, got:"
        );
        expect(() => N.finiteNonnegativeParser.parseOrThrow(f)).toThrow(
          "expected finite nonnegative, got:"
        );
      }
    });
  });

  describe("integer", () => {
    it("allows integers", () => {
      for (const f of [-12, 0, 13]) {
        expect(N.integer(f)).toEqual(f);
        expect(N.integerParser.parseOrThrow(f)).toEqual(f);
      }
    });
    it("disallows non-integers", () => {
      for (const f of [NaN, Infinity, -Infinity, -1.23, 14.91]) {
        expect(() => N.integer(f)).toThrow("expected integer, got:");
        expect(() => N.integerParser.parseOrThrow(f)).toThrow(
          "expected integer, got:"
        );
      }
    });
  });

  describe("nonnegativeInteger", () => {
    it("allows nonnegative integers", () => {
      for (const f of [0, 13]) {
        expect(N.nonnegativeInteger(f)).toEqual(f);
        expect(N.nonnegativeIntegerParser.parseOrThrow(f)).toEqual(f);
      }
    });
    it("disallows non-integers or negative integers", () => {
      for (const f of [NaN, Infinity, -Infinity, -13, -1.23, 14.91]) {
        expect(() => N.nonnegativeInteger(f)).toThrow(
          "expected nonnegative integer, got:"
        );
        expect(() => N.nonnegativeIntegerParser.parseOrThrow(f)).toThrow(
          "expected nonnegative integer, got:"
        );
      }
    });
  });

  describe("proportion", () => {
    it("allows finite numbers in [0, 1]", () => {
      for (const f of [0, 0.3, 1]) {
        expect(N.proportion(f)).toEqual(f);
        expect(N.proportionParser.parseOrThrow(f)).toEqual(f);
      }
    });
    it("disallows numbers outside [0, 1]", () => {
      for (const f of [NaN, Infinity, -Infinity, -13, -1.23, 1.01]) {
        expect(() => N.proportion(f)).toThrow(
          "expected proportion in [0, 1], got:"
        );
        expect(() => N.proportionParser.parseOrThrow(f)).toThrow(
          "expected proportion in [0, 1], got:"
        );
      }
    });
  });
});
