// @flow

import {NodeAddress} from "../../core/graph";
import {identityAddress, identityNode} from "./identity";

describe("src/plugins/identity/identity", () => {
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
      expect(() => identityNode(identity)).toThrowError("Invalid username");
      expect(() => identityAddress(identity.username)).toThrowError(
        "Invalid username"
      );
    });
    it("errors for a bad username", () => {
      const identity = {username: "$foo$bar", aliases: ["github/foo"]};
      expect(() => identityNode(identity)).toThrowError("Invalid username");
      expect(() => identityAddress(identity.username)).toThrowError(
        "Invalid username"
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
