// @flow

import deepFreeze from "deep-freeze";
import {fromString as uuidFromString} from "../util/uuid";
import {NodeAddress} from "../core/graph";
import {graphNode, type Identity, newIdentity} from "./identity";

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
});
