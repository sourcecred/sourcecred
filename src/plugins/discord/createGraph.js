// @flow

import {type WeightedGraph as WeightedGraphT} from "../../core/weightedGraph";
import * as WeightedGraph from "../../core/weightedGraph";
import {
  NodeAddress,
  type Node,
  type Edge,
  type NodeAddressT,
  type EdgeAddressT,
} from "../../core/graph";
import {SqliteMirrorRepository} from "./mirrorRepository";
import {memberNodeType, messageNodeType} from "./declaration";
import * as Model from "./models";

function memberAddress(member: Model.GuildMember): NodeAddressT {
  return NodeAddress.append(
    memberNodeType.prefix,
    member.user.bot ? "bot" : "user",
    member.user.id
  );
}

function memberNode(member: Model.GuildMember): Node {
  const description = `${member.user.username}#${member.user.discriminator}`;
  return {
    address: memberAddress(member),
    description,
    timestampMs: null,
  };
}

function messageAddress(message: Model.Message): NodeAddressT {
  return NodeAddress.append(
    messageNodeType.prefix,
    message.channelId,
    message.id
  );
}

function messageNode(message: Model.Message, guild: Model.Snowflake): Node {
  const url = `https://discordapp.com/channels/${guild}/${message.channelId}/${message.id}`;
  const description = `[Message ${message.id}](${url})`;
  return {
    address: messageAddress(message),
    description,
    timestampMs: message.timestampMs,
  };
}

export function createGraph(
  guild: Model.Snowflake,
  repo: SqliteMirrorRepository
): WeightedGraphT {
  const wg = WeightedGraph.empty();

  const memberMap = new Map(repo.members().map((m) => [m.user.id, m]));
  const channels = repo.channels();
  for (const channel of channels) {
    const messages = repo.messages(channel.id);
    for (const message of messages) {
      if (message.reactionEmoji.length === 0) continue;
      if (message.nonUserAuthor) continue;

      const author = memberMap.get(message.authorId);
      if (!author) throw new Error(`Author not loaded ${message.authorId}`);

      wg.graph.addNode(memberNode(author));
      wg.graph.addNode(messageNode(message, guild));
    }
  }

  return wg;
}
