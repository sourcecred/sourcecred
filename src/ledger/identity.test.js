// @flow

import deepFreeze from "deep-freeze";
import {fromString as uuidFromString} from "../util/uuid";
import {NodeAddress} from "../core/graph";
import {
  identityNameFromString,
  graphNode,
  type Identity,
  newIdentity,
} from "./identity";

describe("ledger/identity", () => {
  const example: Identity = deepFreeze(newIdentity("foo"));
  describe("newIdentity", () => {
    it("new identities don't have aliases", () => {
      const identity = newIdentity("foo");
      expect(identity.aliases).toEqual([]);
    });
    it("identity addresses are as expected", () => {
      const identity = newIdentity("foo");
      expect(identity.address).toEqual(
        NodeAddress.fromParts(["sourcecred", "core", "IDENTITY", identity.id])
      );
    });
    it("includes a valid UUID", () => {
      const ident = newIdentity("foo");
      // Should not error
      uuidFromString(ident.id);
    });
    it("errors on invalid names", () => {
      const fail = () => newIdentity("bad string");
      expect(fail).toThrowError("invalid identityName");
    });
  });
  it("graphNode works", () => {
    const node = graphNode(example);
    expect(node.description).toEqual(example.name);
    expect(node.address).toEqual(example.address);
    expect(node.timestampMs).toEqual(null);
  });
  describe("identityNameFromString", () => {
    it("fails on invalid identityNames", () => {
      const bad = [
        "With Space",
        "With.Period",
        "A/Slash",
        "",
        "with_underscore",
        "@name",
      ];
      for (const b of bad) {
        expect(() => identityNameFromString(b)).toThrowError(
          "invalid identityName"
        );
      }
    });
    it("succeeds on valid identityNames", () => {
      const names = ["h", "hi-there", "ZaX99324cab"];
      for (const n of names) {
        expect(identityNameFromString(n)).toEqual(n.toLowerCase());
      }
    });
    it("lower-cases identityNames", () => {
      expect(identityNameFromString("FooBAR")).toEqual("foobar");
    });
  });
});
