// @flow

import {type WeightedGraph as WeightedGraphT} from "../../core/weightedGraph";
import * as WeightedGraph from "../../core/weightedGraph";
import {type Weights, type NodeWeight} from "../../core/weights";
import {
  Graph,
  NodeAddress,
  EdgeAddress,
  type Node,
  type Edge,
  type NodeAddressT,
  type EdgeAddressT,
} from "../../core/graph";
import {SqliteMirrorRepository} from "./mirrorRepository";
import {
  memberNodeType,
  messageNodeType,
  reactionNodeType,
  authorsMessageEdgeType,
  addsReactionEdgeType,
  reactsToEdgeType,
} from "./declaration";
import * as Model from "./models";

function messageUrl(
  guild: Model.Snowflake,
  channel: Model.Snowflake,
  message: Model.Snowflake
) {
  return `https://discordapp.com/channels/${guild}/${channel}/${message}`;
}

function memberAddress(member: Model.GuildMember): NodeAddressT {
  return NodeAddress.append(
    memberNodeType.prefix,
    member.user.bot ? "bot" : "user",
    member.user.id
  );
}

function messageAddress(message: Model.Message): NodeAddressT {
  return NodeAddress.append(
    messageNodeType.prefix,
    message.channelId,
    message.id
  );
}

function reactionAddress(reaction: Model.Reaction): NodeAddressT {
  return NodeAddress.append(
    reactionNodeType.prefix,
    Model.emojiToRef(reaction.emoji),
    reaction.authorId,
    reaction.channelId,
    reaction.messageId
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

function messageNode(message: Model.Message, guild: Model.Snowflake): Node {
  const url = messageUrl(guild, message.channelId, message.id);
  const description = `Message [${message.id}](${url})`;
  return {
    address: messageAddress(message),
    description,
    timestampMs: message.timestampMs,
  };
}

function authorsMessageEdge(
  message: Model.Message,
  author: Model.GuildMember
): Edge {
  const address: EdgeAddressT = EdgeAddress.append(
    authorsMessageEdgeType.prefix,
    author.user.bot ? "bot" : "user",
    author.user.id,
    message.channelId,
    message.id
  );
  return {
    address,
    timestampMs: message.timestampMs,
    src: memberAddress(author),
    dst: messageAddress(message),
  };
}

function reactionNode(reaction: Model.Reaction, guild: Model.Snowflake): Node {
  const msgUrl = messageUrl(guild, reaction.channelId, reaction.messageId);
  const reactionStr = reaction.emoji.id
    ? `:${reaction.emoji.name}:`
    : reaction.emoji.name;
  const description = `Reacted \`${reactionStr}\` to message [${reaction.messageId}](${msgUrl})`;
  return {
    address: reactionAddress(reaction),
    description,
    timestampMs: null,
  };
}

function addsReactionEdge(
  reaction: Model.Reaction,
  member: Model.GuildMember,
  timestampMs: number
): Edge {
  const address: EdgeAddressT = EdgeAddress.append(
    addsReactionEdgeType.prefix,
    member.user.bot ? "bot" : "user",
    member.user.id,
    Model.emojiToRef(reaction.emoji),
    reaction.channelId,
    reaction.messageId
  );
  return {
    address,
    // TODO: for now using timestamp of the message,
    // as reactions don't have timestamps.
    timestampMs,
    src: memberAddress(member),
    dst: reactionAddress(reaction),
  };
}

function reactsToEdge(reaction: Model.Reaction, message: Model.Message): Edge {
  const address: EdgeAddressT = EdgeAddress.append(
    reactsToEdgeType.prefix,
    Model.emojiToRef(reaction.emoji),
    reaction.authorId,
    reaction.channelId,
    reaction.messageId
  );
  return {
    address,
    // TODO: for now using timestamp of the message,
    // as reactions don't have timestamps.
    timestampMs: message.timestampMs,
    src: reactionAddress(reaction),
    dst: messageAddress(message),
  };
}

export type EmojiWeightMap = {[ref: Model.EmojiRef]: NodeWeight};

export function createGraph(
  guild: Model.Snowflake,
  repo: SqliteMirrorRepository,
  declarationWeights: Weights,
  emojiWeights: EmojiWeightMap
): WeightedGraphT {
  const wg = {
    graph: new Graph(),
    weights: declarationWeights,
  };

  const memberMap = new Map(repo.members().map((m) => [m.user.id, m]));
  const channels = repo.channels();
  for (const channel of channels) {
    const messages = repo.messages(channel.id);
    for (const message of messages) {
      if (message.reactionEmoji.length === 0) continue;
      if (message.nonUserAuthor) continue;

      let hasWeightedEmoji = false;
      const reactions = repo.reactions(channel.id, message.id);
      for (const reaction of reactions) {
        const emojiRef = Model.emojiToRef(reaction.emoji);
        const reactionWeight = emojiWeights[emojiRef];

        // TODO: Skip all unweighted emoji in prototype.
        if (!reactionWeight) continue;

        const reactingMember = memberMap.get(reaction.authorId);
        if (!reactingMember) {
          throw new Error(`Reacting member not loaded ${reaction.authorId}`);
        }

        hasWeightedEmoji = true;
        const node = reactionNode(reaction, guild);
        wg.weights.nodeWeights.set(node.address, reactionWeight);
        wg.graph.addNode(node);
        wg.graph.addNode(memberNode(reactingMember));
        wg.graph.addEdge(reactsToEdge(reaction, message));
        wg.graph.addEdge(
          addsReactionEdge(reaction, reactingMember, message.timestampMs)
        );
      }

      // Don't bloat the graph with no-weighted-reaction messages.
      if (hasWeightedEmoji) {
        const author = memberMap.get(message.authorId);
        if (!author) {
          throw new Error(`Message author not loaded ${message.authorId}`);
        }
        wg.graph.addNode(memberNode(author));
        wg.graph.addNode(messageNode(message, guild));
        wg.graph.addEdge(authorsMessageEdge(message, author));
      }
    }
  }

  return wg;
}
