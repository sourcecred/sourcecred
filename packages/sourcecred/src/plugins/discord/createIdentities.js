// @flow

import {escape} from "entities";
import {SqliteMirrorRepository} from "./mirrorRepository";
import * as Model from "./models";
import {memberAddress} from "./createGraph";
import {type IdentityProposal} from "../../core/ledger/identityProposal";
import {coerce, nameFromString} from "../../core/identity/name";
import tryEach from "../../util/tryEach";

const MAX_LENGTH = 40;

export function createIdentity(member: Model.GuildMember): IdentityProposal {
  let name =
    member.nick?.slice(0, MAX_LENGTH - 1) ||
    member.user.username.slice(0, MAX_LENGTH - 1);
  let id = "discord-" + member.user.id.slice(0, MAX_LENGTH - 1);

  name = tryEach(
    () => coerce(name),
    () => coerce(id)
  );

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
