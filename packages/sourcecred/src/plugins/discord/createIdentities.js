// @flow

import {escape} from "entities";
import {SqliteMirrorRepository} from "./mirrorRepository";
import * as Model from "./models";
import {memberAddress} from "./createGraph";
import {type IdentityProposal} from "../../core/ledger/identityProposal";
import {coerce, nameFromString} from "../../core/identity/name";

export function createIdentity(member: Model.GuildMember): IdentityProposal {
  let name = member.nick || member.user.username;
  name = coerce(name.slice(0, 39));
  if (name.match(/^\-+$/) name = coerce("discord-" + member.user.id);
  const description = `discord/${escape(name)}#${member.user.discriminator}`;
  const alias = {
    description,
    address: memberAddress(member),
  };
  const type = member.user.bot ? "BOT" : "USER";
  return {
    pluginName: nameFromString("discord"),
    name,
    type,
    alias,
  };
}

export function createIdentities(
  repo: SqliteMirrorRepository
): $ReadOnlyArray<IdentityProposal> {
  return repo.members().map((m) => createIdentity(m));
}
