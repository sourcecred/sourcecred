// @flow

import type {TimestampMs, TimestampISO} from "./timestamp";
import {fromISO, toISO, fromNumber} from "./timestamp";

/**
 * Helper function to write readable "toThrow" tests. This intentionally
 * ignores Flow types, as we want to test runtime input validation.
 *
 * Use by replacing:
 *   expect(() => fn(...args)).toThrow();
 * With:
 *   given(...args).expect(fn).toThrow();
 */
function given(...args: mixed[]) {
  return {
    expect: (fn: Function) => expect(() => fn(...args)),
  };
}

describe("util/timestamp", () => {
  const fullExample = {
    ISO: (("2020-01-01T12:34:56.789Z": any): TimestampISO),
    ms: ((1577882096789: any): TimestampMs),
  };
  const partialExample = {
    ISO: (("2020-01-01": any): TimestampISO),
    fullISO: (("2020-01-01T00:00:00.000Z": any): TimestampISO),
    ms: ((1577836800000: any): TimestampMs),
  };

  // These double as a Flow sanity check.
  describe("roundtrips", () => {
    it("should handle number roundtrips", () => {
      const origin: number = fullExample.ms;
      expect(fromNumber(origin)).toBe(origin);
      expect(fromISO(toISO(origin))).toBe(origin);
      expect(fromNumber(fromISO(toISO(origin)))).toBe(origin);
    });
    it("should handle ISO roundtrips", () => {
      const origin: TimestampISO = fullExample.ISO;
      expect(toISO(fromISO(origin))).toBe(origin);
      expect(toISO(fromNumber(fromISO(origin)))).toBe(origin);
    });
  });

  describe("toISO", () => {
    it("should throw on null", () => {
      given(null).expect(toISO).toThrow(TypeError);
    });
    it("should throw on undefined", () => {
      given(undefined).expect(toISO).toThrow(TypeError);
    });
    it("should throw on NaN", () => {
      given(NaN).expect(toISO).toThrow(TypeError);
    });
    it("should throw on Infinity", () => {
      given(Infinity).expect(toISO).toThrow(TypeError);
    });
    it("should throw on ISO strings", () => {
      given("2020-01-01T12:34:56.789Z").expect(toISO).toThrow(TypeError);
    });
    it("should handle 0 correctly", () => {
      expect(toISO(0)).toBe("1970-01-01T00:00:00.000Z");
    });
    it("should handle Date.now correctly", () => {
      const now = Date.now();
      const nowISO = new Date(now).toISOString();
      expect(toISO(now)).toBe(nowISO);
    });
    it("should handle examples correctly", () => {
      expect(toISO(fullExample.ms)).toBe(fullExample.ISO);
      expect(toISO(partialExample.ms)).toBe(partialExample.fullISO);
    });
  });

  describe("fromISO", () => {
    it("should throw on null", () => {
      given(null).expect(fromISO).toThrow(TypeError);
    });
    it("should throw on undefined", () => {
      given(undefined).expect(fromISO).toThrow(TypeError);
    });
    it("should throw on numbers", () => {
      given(123).expect(fromISO).toThrow(TypeError);
    });
    it("should handle examples correctly", () => {
      expect(fromISO(fullExample.ISO)).toBe(fullExample.ms);
      expect(fromISO(partialExample.ISO)).toBe(partialExample.ms);
    });
    it("should throw on invalid formatting", () => {
      given("04/31/2016 12:46pm").expect(fromISO).toThrow(RangeError);
    });
    it("should throw on illegal date", () => {
      given("2000-02-32T00:00:00.000Z").expect(fromISO).toThrow(RangeError);
    });
  });

  describe("fromNumber", () => {
    it("should throw on null", () => {
      given(null).expect(fromNumber).toThrow(TypeError);
    });
    it("should throw on undefined", () => {
      given(undefined).expect(fromNumber).toThrow(TypeError);
    });
    it("should throw on NaN", () => {
      given(NaN).expect(fromNumber).toThrow(TypeError);
    });
    it("should throw on Infinity", () => {
      given(Infinity).expect(fromNumber).toThrow(TypeError);
    });
    it("should throw on floating point numbers", () => {
      given(1 / 3)
        .expect(fromNumber)
        .toThrow(TypeError);
    });
    it("should handle 0 correctly", () => {
      expect(fromNumber(0)).toBe(0);
    });
    it("should handle Date.now correctly", () => {
      const now = Date.now();
      expect(fromNumber(now)).toBe(now);
    });
    it("should handle examples correctly", () => {
      expect(fromNumber(fullExample.ms)).toBe(fullExample.ms);
      expect(fromNumber(partialExample.ms)).toBe(partialExample.ms);
    });
  });
});
