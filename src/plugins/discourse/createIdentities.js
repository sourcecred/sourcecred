// @flow

import {type IdentityProposal} from "../../core/ledger/identityProposal";
import {type IdentityType} from "../../core/identity";
import {coerce, nameFromString} from "../../core/identity/name";
import {type ReadRepository} from "./mirrorRepository";
import {type User} from "./fetch";
import {userAddress} from "./address";

function guessUserType(username: string): IdentityType {
  if (username === "system" || username === "discobot") {
    return "BOT";
  }
  return "USER";
}

export function _createIdentity(
  serverUrl: string,
  user: User
): IdentityProposal {
  const {username} = user;
  const url = `${serverUrl}/u/${username}/`;
  const description = `discourse/[@${username}](${url})`;
  const address = userAddress(serverUrl, username);
  const alias = {description, address};
  return {
    pluginName: nameFromString("discourse"),
    name: coerce(username),
    type: guessUserType(username),
    alias,
  };
}

export function createIdentities(
  serverUrl: string,
  repo: ReadRepository
): $ReadOnlyArray<IdentityProposal> {
  return repo.users().map((u) => _createIdentity(serverUrl, u));
}
