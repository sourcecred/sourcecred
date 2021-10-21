// @flow

import {escape} from "entities";
import {SqliteMirrorRepository} from "./mirrorRepository";
import * as Model from "./models";
import {type IdentityProposal} from "../../core/ledger/identityProposal";
import {coerce, nameFromString} from "../../core/identity/name";

import {type WeightedGraph as WeightedGraphT} from "../../core/weightedGraph";
import {empty as emptyWeights} from "../../core/weights";
import {
  Graph,
  NodeAddress,
  EdgeAddress,
  type Node,
  type Edge,
  type NodeAddressT,
  type EdgeAddressT,
} from "../../core/graph";
import {
  memberNodeType,
  messageNodeType,
  reactionNodeType,
  authorsMessageEdgeType,
  addsReactionEdgeType,
  reactsToEdgeType,
  mentionsEdgeType,
  propsEdgeType,
} from "./declaration";

import {type DiscordConfig} from "./config";
import {reactionWeight} from "./reactionWeights";

// Display this many characters in description.
const MESSAGE_LENGTH = 30;

function messageUrl(
  guild: Model.Snowflake,
  channel: Model.Snowflake,
  message: Model.Snowflake
) {
  return `https://discordapp.com/channels/${guild}/${channel}/${message}`;
}

export function userAddress(userId: Model.Snowflake): NodeAddressT {
  return NodeAddress.append(memberNodeType.prefix, "user", userId);
}

export function memberAddress(member: Model.GuildMember): NodeAddressT {
  return NodeAddress.append(
    memberNodeType.prefix,
    member.user.bot ? "bot" : "user",
    member.user.id
  );
}

export function createIdentity(member: Model.GuildMember): IdentityProposal {
  let name = member.nick || member.user.username;
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
  return repo.members().map((m) => createIdentity(m));
}
