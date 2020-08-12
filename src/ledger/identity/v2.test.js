// @flow

import deepFreeze from "deep-freeze";
import {NodeAddress} from "../../core/graph";
import {loginFromString} from "./login";
import {type IdentityDescription} from "./description";
import {type Alias} from "./alias";
import {newIdentity, parser, graphNode, identityAddress} from "./v2";
import {parser as uuidParser} from "../../util/uuid";
import {IDENTITY_PREFIX} from "./declaration";

describe("ledger/identity/v2", () => {
  const description: IdentityDescription = deepFreeze({
    login: loginFromString("user"),
    type: "USER",
    displayName: "A User",
  });
  const aliases: $ReadOnlyArray<Alias> = deepFreeze([
    {address: NodeAddress.empty, description: "alias"},
  ]);
  const identity = deepFreeze(newIdentity(description, aliases));
  describe("newIdentity", () => {
    it("uses included description and aliases, and provides a uuid", () => {
      expect(identity.aliases).toEqual(aliases);
      expect(identity.description).toEqual(description);
      // Proof that we have a valid id
      uuidParser.parseOrThrow(identity.id);
      parser.parseOrThrow(identity);
    });
    it("errors if there's an invalid description", () => {
      const description = {
        login: loginFromString("user"),
        type: "BAR",
        displayName: "A User",
      };
      const aliases = [{address: NodeAddress.empty, description: "alias"}];
      // $FlowExpectedError
      const thunk = () => newIdentity(description, aliases);
      expect(thunk).toThrowError("description");
    });
    it("errors if there's an invalid alias", () => {
      const description = {
        login: loginFromString("user"),
        type: "USER",
        displayName: "A User",
      };
      const aliases = [{address: "nope", description: "alias"}];
      // $FlowExpectedError
      const thunk = () => newIdentity(description, aliases);
      expect(thunk).toThrowError("aliases");
    });
  });
  it("identityAddress works", () => {
    expect(identityAddress(identity)).toEqual(
      NodeAddress.append(IDENTITY_PREFIX, identity.id)
    );
  });
  it("graphNode works", () => {
    const node = graphNode(identity);
    expect(node.description).toEqual(identity.description.displayName);
    expect(node.address).toEqual(identityAddress(identity));
    expect(node.timestampMs).toEqual(null);
  });
});
