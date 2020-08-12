// @flow

import deepFreeze from "deep-freeze";
import {fromString as uuidFromString} from "../util/uuid";
import {NodeAddress} from "../core/graph";
import {
  loginFromString,
  graphNode,
  type Identity,
  newIdentity,
} from "./identity";

describe("ledger/identity", () => {
  const example: Identity = deepFreeze(newIdentity("USER", "foo"));
  describe("newIdentity", () => {
    it("new identities don't have aliases", () => {
      const identity = newIdentity("USER", "foo");
      expect(identity.aliases).toEqual([]);
    });
    it("identity addresses are as expected", () => {
      const subtypes = ["USER", "BOT", "PROJECT", "ORGANIZATION"];
      for (const subtype of subtypes) {
        const identity = newIdentity(subtype, "foo");
        expect(identity.address).toEqual(
          NodeAddress.fromParts([
            "sourcecred",
            "core",
            "IDENTITY",
            subtype,
            identity.id,
          ])
        );
      }
    });
    it("includes a valid UUID", () => {
      const ident = newIdentity("USER", "foo");
      // Should not error
      uuidFromString(ident.id);
    });
    it("errors on invalid names", () => {
      const fail = () => newIdentity("USER", "bad string");
      expect(fail).toThrowError("invalid login");
    });
    it("errors on invalid subtype", () => {
      // $FlowExpectedError
      const fail = () => newIdentity("FOO", "name");
      expect(fail).toThrowError("invalid identity subtype: ");
    });
  });
  it("graphNode works", () => {
    const node = graphNode(example);
    expect(node.description).toEqual(example.name);
    expect(node.address).toEqual(example.address);
    expect(node.timestampMs).toEqual(null);
  });
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
