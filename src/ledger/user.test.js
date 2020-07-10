// @flow

import deepFreeze from "deep-freeze";
import {fromString as uuidFromString} from "../util/uuid";
import {NodeAddress} from "../core/graph";
import {
  userAddress,
  usernameFromString,
  USER_PREFIX,
  graphNode,
  type User,
} from "./user";

describe("ledger/user", () => {
  const uuid = uuidFromString("YVZhbGlkVXVpZEF0TGFzdA");
  const name = usernameFromString("foo");
  const example: User = deepFreeze({
    id: uuid,
    name,
    aliases: [NodeAddress.empty],
  });
  it("userAddress works", () => {
    expect(userAddress(uuid)).toEqual(NodeAddress.append(USER_PREFIX, uuid));
  });
  it("graphNode works", () => {
    const node = graphNode(example);
    expect(node.description).toEqual(example.name);
    expect(node.address).toEqual(userAddress(uuid));
    expect(node.timestampMs).toEqual(null);
  });
  describe("usernameFromString", () => {
    it("fails on invalid usernames", () => {
      const bad = [
        "With Space",
        "With.Period",
        "A/Slash",
        "",
        "with_underscore",
        "@name",
      ];
      for (const b of bad) {
        expect(() => usernameFromString(b)).toThrowError("invalid username");
      }
    });
    it("succeeds on valid usernames", () => {
      const names = ["h", "hi-there", "ZaX99324cab"];
      for (const n of names) {
        expect(usernameFromString(n)).toEqual(n.toLowerCase());
      }
    });
    it("lower-cases usernames", () => {
      expect(usernameFromString("FooBAR")).toEqual("foobar");
    });
  });
});
