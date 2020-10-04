// @flow

import {type IdentityProposal} from "../../core/ledger/identityProposal";
import {coerce, nameFromString} from "../../core/identity/name";
import {RelationalView, Userlike} from "./relationalView";
import {toRaw} from "./nodes";

export function _createIdentity(u: Userlike): IdentityProposal {
  const alias = {
    description: u.description(),
    address: toRaw(u.address()),
  };
  function chooseType(u: Userlike) {
    const subtype = u.address().subtype;
    // TODO: We should let it infer ORGANIZATION or PROJECT types too,
    // but at present we'll let the maintainer set this directly in the UI.
    switch (subtype) {
      case "USER": {
        return "USER";
      }
      case "BOT": {
        return "BOT";
      }
      default:
        throw new Error(`unknown userlike subtype: ${(subtype: empty)}`);
    }
  }
  return {
    pluginName: nameFromString("github"),
    name: coerce(u.login()),
    type: chooseType(u),
    alias,
  };
}

export function createIdentities(
  rv: RelationalView
): $ReadOnlyArray<IdentityProposal> {
  return Array.from(rv.userlikes()).map(_createIdentity);
}
