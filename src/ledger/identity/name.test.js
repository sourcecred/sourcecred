// @flow

import {nameFromString} from "./name";

describe("ledger/identity/name", () => {
  describe("nameFromString", () => {
    it("fails on invalid names", () => {
      const bad = [
        "With Space",
        "With.Period",
        "A/Slash",
        "",
        "with_underscore",
        "@name",
      ];
      for (const b of bad) {
        expect(() => nameFromString(b)).toThrowError("invalid name");
      }
    });
    it("succeeds on valid names", () => {
      const names = ["h", "hi-there", "ZaX99324cab"];
      for (const n of names) {
        expect(nameFromString(n)).toEqual(n.toLowerCase());
      }
    });
    it("lower-cases names", () => {
      expect(nameFromString("FooBAR")).toEqual("foobar");
    });
  });
});
