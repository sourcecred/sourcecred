//@flow 

import {escape} from "entities";
import {SqliteMirrorRepository} from "./mirrorRepository";
import * as Model from "./models";
import {memberAddress} from "./createGraph";
import {type IdentityProposal} from "../../core/ledger/identityProposal";
import {coerce, nameFromString} from "../../core/identity/name";

export function _createIdentity(member: Model.User): IdentityProposal {
  let name = member.name !== null ? member.name : member.email;
  name = name.slice(0, 39);
  const description = `slack/${escape(name)}`;
  const alias = {
    description,
    address: memberAddress(member),
  };
  return {
    pluginName: nameFromString("discord"),
    name: coerce(name),
    type: "USER",
    alias,
  };
}

export function createIdentities(
  repo: SqliteMirrorRepository
): $ReadOnlyArray<IdentityProposal> {
  return repo.members().map((m) => _createIdentity(m));
}
