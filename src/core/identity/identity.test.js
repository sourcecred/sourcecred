// @flow

import deepFreeze from "deep-freeze";
import {fromString as uuidFromString} from "../../util/uuid";
import {NodeAddress} from "../../core/graph";
import {graphNode, type Identity, newIdentity} from "./identity";

describe("core/identity/identity", () => {
  const example: Identity = deepFreeze(newIdentity("USER", "foo"));
  describe("newIdentity", () => {
    it("by default, new identities don't have aliases", () => {
      const identity = newIdentity("USER", "foo");
      expect(identity.aliases).toEqual([]);
    });
    it("new identities may have aliases", () => {
      const alias = {description: "alias", address: NodeAddress.empty};
      const identity = newIdentity("USER", "foo", [alias]);
      expect(identity.aliases).toEqual([alias]);
    });
    it("errors if a new identity has multiple aliases with the same address", () => {
      const a1 = {description: "a1", address: NodeAddress.empty};
      const a2 = {description: "a2", address: NodeAddress.empty};
      const thunk = () => newIdentity("USER", "foo", [a1, a2]);
      expect(thunk).toThrowError("multiple aliases share an address");
    });
    it("identity addresses are as expected", () => {
      const subtypes = ["USER", "BOT", "PROJECT", "ORGANIZATION"];
      for (const subtype of subtypes) {
        const identity = newIdentity(subtype, "foo");
        expect(identity.address).toEqual(
          // subtypes are NOT included in the address, because
          // subtypes can be modified after identity creation.
          // Note that some old identities that are in productionized cred instances
          // do contain subtypes in the address.
          NodeAddress.fromParts(["sourcecred", "core", "IDENTITY", identity.id])
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
      expect(fail).toThrowError("invalid name");
    });
    it("errors on invalid subtype", () => {
      // $FlowExpectedError[incompatible-call]
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
