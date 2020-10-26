// @flow

import {nameFromString, coerce} from "./name";

describe("core/identity/name", () => {
  describe("nameFromString", () => {
    it("fails on very long names", () => {
      const bad = "1234567890123456789012345678901234567890123";
      expect(() => nameFromString(bad)).toThrowError("too long");
    });
    it("fails on names with invalid characters", () => {
      const bad = [
        "With Space",
        "With.Period",
        "A/Slash",
        "with_underscore",
        "",
        "@name",
      ];
      for (const b of bad) {
        expect(() => nameFromString(b)).toThrowError("invalid name");
      }
    });
    it("succeeds on valid names", () => {
      const names = ["h", "hi-there", "ZaX99324cab"];
      for (const n of names) {
        expect(nameFromString(n)).toEqual(n);
      }
    });
    it("does not lower-case names", () => {
      expect(nameFromString("FooBAR")).toEqual("FooBAR");
    });
  });

  describe("coerce", () => {
    it("does not change valid names", () => {
      const names = ["hi", "Foo-123-Bar", "X"];
      const coerced = names.map(coerce);
      expect(names).toEqual(coerced);
    });
    it("replaces invalid characters with dashes", () => {
      expect(coerce("My Special Name")).toEqual("My-Special-Name");
      expect(coerce("A!@#$%^Z")).toEqual("A------Z");
    });
    it("still fails on names with invalid length", () => {
      const t1 = () => coerce("");
      expect(t1).toThrowError("invalid name");
      const t2 = () => coerce("1234567890123456789012345678901234567890123");
      expect(t2).toThrowError("too long");
    });
  });
});
