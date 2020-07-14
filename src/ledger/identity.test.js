// @flow

import deepFreeze from "deep-freeze";
import {fromString as uuidFromString} from "../util/uuid";
import {NodeAddress} from "../core/graph";
import {
  identityAddress,
  identityNameFromString,
  IDENTITY_PREFIX,
  graphNode,
  type Identity,
} from "./identity";

describe("ledger/identity", () => {
  const uuid = uuidFromString("YVZhbGlkVXVpZEF0TGFzdA");
  const name = identityNameFromString("foo");
  const example: Identity = deepFreeze({
    id: uuid,
    name,
    aliases: [NodeAddress.empty],
  });
  it("identityAddress works", () => {
    expect(identityAddress(uuid)).toEqual(
      NodeAddress.append(IDENTITY_PREFIX, uuid)
    );
  });
  it("graphNode works", () => {
    const node = graphNode(example);
    expect(node.description).toEqual(example.name);
    expect(node.address).toEqual(identityAddress(uuid));
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
