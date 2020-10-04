// @flow

import {escape} from "entities";
import {SqliteMirrorRepository} from "./mirrorRepository";
import * as Model from "./models";
import {memberAddress} from "./createGraph";
import {type IdentityProposal} from "../../core/ledger/identityProposal";
import {coerce, nameFromString} from "../../core/identity/name";

export function _createIdentity(member: Model.GuildMember): IdentityProposal {
  let name = member.nick !== null ? member.nick : member.user.username;
  // Discord allows very long names. Let's ensure the length is reasonable.
  name = name.slice(0, 39);
  const description = `discord/${escape(name)}#${member.user.discriminator}`;
  const alias = {
    description,
    address: memberAddress(member),
  };
  const type = member.user.bot ? "BOT" : "USER";
  return {
    pluginName: nameFromString("discord"),
    name: coerce(name),
    type,
    alias,
  };
}

export function createIdentities(
  repo: SqliteMirrorRepository
): $ReadOnlyArray<IdentityProposal> {
  return repo.members().map((m) => _createIdentity(m));
}
