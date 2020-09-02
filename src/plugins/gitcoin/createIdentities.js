// @flow

import {escape} from "entities";
import {PostgresMirrorRepository} from "./mirrorRepository";
import {type User} from "./fetch";
import {userAddress} from "./address";
import {type IdentityProposal} from "../../ledger/identityProposal";
import {coerce, nameFromString} from "../../ledger/identity/name";

export function _createIdentity(user: User): IdentityProposal {
  const description = `gitcoin/${escape(user.name)}`;
  const alias = {
    description,
    address: userAddress("", user.name),
  };
  const type = "USER";
  return {
    pluginName: nameFromString("gitcoin"),
    name: user.name ? coerce(user.name) : coerce("shouldnthappen"),
    type,
    alias,
  };
}

export function createIdentities(
  repo: PostgresMirrorRepository
): $ReadOnlyArray<IdentityProposal> {
  return repo.users().map((u) => _createIdentity(u));
}
