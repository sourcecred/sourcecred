// @flow

import {escape} from "entities";
import * as NullUtil from "../../util/null";
import {type WeightedGraph as WeightedGraphT} from "../../core/weightedGraph";
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
  mentionsEdgeType,
} from "./declaration";
import * as Model from "./models";

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

function messageAddress(message: Model.Message): NodeAddressT {
  return NodeAddress.append(
    messageNodeType.prefix,
    message.channelId,
    message.id
  );
}

function reactionAddress(reaction: Model.Reaction): NodeAddressT {
  // Hacky order, so we can boost categories.
  return NodeAddress.append(
    reactionNodeType.prefix,
    reaction.channelId,
    Model.emojiToRef(reaction.emoji),
    reaction.authorId,
    reaction.messageId
  );
}

function memberNode(member: Model.GuildMember): Node {
  const description = `discord/${escape(member.user.username.slice(0, 20))}#${
    member.user.discriminator
  }`;
  return {
    address: memberAddress(member),
    description,
    timestampMs: null,
  };
}

function messageNode(
  message: Model.Message,
  guild: Model.Snowflake,
  channelName: string
): Node {
  const url = messageUrl(guild, message.channelId, message.id);
  const partialMessage = escape(message.content.substring(0, MESSAGE_LENGTH));
  const description = `#${channelName} message ["${partialMessage}..."](${url})`;
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

function reactionNode(
  reaction: Model.Reaction,
  timestampMs: number,
  guild: Model.Snowflake
): Node {
  const msgUrl = messageUrl(guild, reaction.channelId, reaction.messageId);
  const reactionStr = reaction.emoji.id
    ? `:${reaction.emoji.name}:`
    : reaction.emoji.name;
  const description = `Reacted \`${reactionStr}\` to message [${reaction.messageId}](${msgUrl})`;
  return {
    address: reactionAddress(reaction),
    description,
    timestampMs,
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

function mentionsEdge(message: Model.Message, member: Model.GuildMember): Edge {
  const address: EdgeAddressT = EdgeAddress.append(
    mentionsEdgeType.prefix,
    message.channelId,
    message.authorId,
    message.id,
    member.user.bot ? "bot" : "user",
    member.user.id
  );
  return {
    address,
    timestampMs: message.timestampMs,
    src: messageAddress(message),
    dst: memberAddress(member),
  };
}

export type EmojiWeightMap = {[ref: Model.EmojiRef]: NodeWeight};
export type RoleWeightMap = {[ref: Model.Snowflake]: NodeWeight};

export type RoleWeightConfig = {|
  +defaultWeight: number,
  +roleWeights: RoleWeightMap,
|};

export function createGraph(
  guild: Model.Snowflake,
  repo: SqliteMirrorRepository,
  declarationWeights: Weights,
  emojiWeights: EmojiWeightMap,
  roleWeightConfig: RoleWeightConfig
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
      if (message.mentions.length === 0 && message.reactionEmoji.length === 0)
        continue;
      if (message.nonUserAuthor) continue;

      let hasEdges = false;
      const reactions = repo.reactions(channel.id, message.id);
      for (const reaction of reactions) {
        const emojiRef = Model.emojiToRef(reaction.emoji);
        const reactingMember = memberMap.get(reaction.authorId);
        let reactionWeight = NullUtil.orElse(emojiWeights[emojiRef], 1);

        if (message.authorId === reaction.authorId) {
          reactionWeight = 0;
        }

        if (!reactingMember) {
          // Probably this user left the server.
          continue;
        }

        // get the weight of the highest weight role the reacting user has
        let roleWeight = roleWeightConfig.defaultWeight;
        const roleWeights = roleWeightConfig.roleWeights;
        for (const roleRef of reactingMember.roles) {
          const matchingWeight = roleWeights[roleRef];
          if (matchingWeight != null && matchingWeight > roleWeight) {
            roleWeight = matchingWeight;
          }
        }

        const node = reactionNode(reaction, message.timestampMs, guild);
        wg.weights.nodeWeights.set(node.address, roleWeight * reactionWeight);
        wg.graph.addNode(node);
        wg.graph.addNode(memberNode(reactingMember));
        wg.graph.addEdge(reactsToEdge(reaction, message));
        wg.graph.addEdge(
          addsReactionEdge(reaction, reactingMember, message.timestampMs)
        );
        hasEdges = true;
      }

      for (const userId of message.mentions) {
        const mentionedMember = memberMap.get(userId);
        if (!mentionedMember) {
          // Probably this user left the server.
          continue;
        }
        wg.graph.addNode(memberNode(mentionedMember));
        wg.graph.addEdge(mentionsEdge(message, mentionedMember));
        hasEdges = true;
      }

      // Don't bloat the graph with isolated messages.
      if (hasEdges) {
        const author = memberMap.get(message.authorId);
        if (!author) {
          // Probably this user left the server.
          continue;
        }
        wg.graph.addNode(memberNode(author));
        wg.graph.addNode(messageNode(message, guild, channel.name));
        wg.graph.addEdge(authorsMessageEdge(message, author));
      }
    }
  }

  return wg;
}
