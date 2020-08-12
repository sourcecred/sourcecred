// @flow

import {loginFromString} from "./login";

describe("ledger/identity/login", () => {
  describe("loginFromString", () => {
    it("fails on invalid logins", () => {
      const bad = [
        "With Space",
        "With.Period",
        "A/Slash",
        "",
        "with_underscore",
        "@name",
      ];
      for (const b of bad) {
        expect(() => loginFromString(b)).toThrowError("invalid login");
      }
    });
    it("succeeds on valid logins", () => {
      const names = ["h", "hi-there", "ZaX99324cab"];
      for (const n of names) {
        expect(loginFromString(n)).toEqual(n.toLowerCase());
      }
    });
    it("lower-cases logins", () => {
      expect(loginFromString("FooBAR")).toEqual("foobar");
    });
  });
});
