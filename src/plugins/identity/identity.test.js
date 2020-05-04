// @flow

import {NodeAddress} from "../../core/graph";
import {identityAddress, identityNode, validateUsername} from "./identity";

describe("src/plugins/identity/identity", () => {
  describe("validateUsername", () => {
    it("accepts good inputs", () => {
      const good = ["foo", "123", "foo-123", "foo_bar-123", "_S-A-M_"];
      const usernames = good.map(validateUsername);
      expect(good).toEqual(usernames);
    });
    it("strips leading @-signs", () => {
      const good = ["foo", "123", "foo-123", "foo_bar-123", "_S-A-M_"];
      const usernames = good.map((g) => validateUsername("@" + g));
      expect(good).toEqual(usernames);
    });
    it("rejects bad inputs", () => {
      const bad = ["", "@", "@foo@", "foo$bar"];
      for (const b of bad) {
        expect(() => validateUsername(b)).toThrow("invalid username");
      }
    });
  });
  describe("identityNode & identityAddress", () => {
    it("works as expected for valid identity", () => {
      const identity = {username: "foo", aliases: ["github/foo"]};
      const n = identityNode(identity);
      expect(n.address).toEqual(
        NodeAddress.fromParts(["sourcecred", "identity", "foo"])
      );
      expect(identityAddress(identity.username)).toEqual(n.address);
      expect(n.timestampMs).toEqual(null);
      expect(n.description).toEqual("@foo");
    });
    it("errors for an empty username", () => {
      const identity = {username: "", aliases: ["github/foo"]};
      expect(() => identityNode(identity)).toThrowError("invalid username");
      expect(() => identityAddress(identity.username)).toThrowError(
        "invalid username"
      );
    });
    it("errors for a bad username", () => {
      const identity = {username: "$foo$bar", aliases: ["github/foo"]};
      expect(() => identityNode(identity)).toThrowError("invalid username");
      expect(() => identityAddress(identity.username)).toThrowError(
        "invalid username"
      );
    });
    it("strips redundant leading @ from the description and address", () => {
      const identity = {username: "@foo", aliases: ["github/foo"]};
      const n = identityNode(identity);
      expect(n.address).toEqual(
        NodeAddress.fromParts(["sourcecred", "identity", "foo"])
      );
      expect(identityAddress(identity.username)).toEqual(n.address);
      expect(n.timestampMs).toEqual(null);
      expect(n.description).toEqual("@foo");
    });
  });
});
