// @flow

import {escape} from "entities";
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
import {SqliteMirrorRepository} from "./mirrorRepository";
import {
  memberNodeType,
  messageNodeType,
  reactionNodeType,
  authorsMessageEdgeType,
  addsReactionEdgeType,
  reactsToEdgeType,
  mentionsEdgeType,
  propsEdgeType,
  keys,
} from "./declaration";
import * as Model from "./models";

import {type DiscordConfig} from "./config";
import {reactionWeight} from "./reactionWeights";
import type {
  Contribution,
  Expression,
} from "../../core/credequate/contribution";
import type {Config} from "../../core/credequate/config";

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

function propsEdge(message: Model.Message, member: Model.GuildMember): Edge {
  const address: EdgeAddressT = EdgeAddress.append(
    propsEdgeType.prefix,
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

export type GraphReaction = {|
  +reaction: Model.Reaction,
  +reactingMember: Model.GuildMember,
|};

export type GraphMention = {|
  +member: Model.GuildMember,
  +count: number,
|};

/**
 * All of the information necessary to add a message to
 * the graph, along with its reactions and its mentions.
 */
export type GraphMessage = {|
  +message: Model.Message,
  +author: Model.GuildMember | null,
  +reactions: $ReadOnlyArray<GraphReaction>,
  +mentions: $ReadOnlyArray<GraphMention>,
  // Included so we can apply any channel-based rules (e.g. creating props
  // edges instead of mentions edges) at graph construction time.
  +channelId: Model.Snowflake,
  // Included because we want the channel name in the node description.
  +channelName: string,
  +channelParentId?: Model.Snowflake,
|};

/**
 * Find all of the messages that should go into the graph.
 * This will deliberately ignore messages that have no reactions, since
 * they have no Cred impact and don't need to go into the graph.
 */
export function* findGraphMessages(
  repo: SqliteMirrorRepository
): Iterable<GraphMessage> {
  const memberMap = new Map(repo.members().map((m) => [m.user.id, m]));
  for (const channel of repo.channels()) {
    for (const message of repo.messages(channel.id)) {
      if (message.nonUserAuthor) {
        continue;
      }

      const reactions = [];
      for (const reaction of repo.reactions(channel.id, message.id)) {
        const reactingMember = memberMap.get(reaction.authorId);
        if (!reactingMember) {
          // Probably this user left the server.
          // Let's ignore this reaction (keeping the rest of the message)
          continue;
        }
        reactions.push({reaction, reactingMember});
      }

      const mentions = [];
      for (const {userId, count} of message.mentions) {
        const mentionedMember = memberMap.get(userId);
        if (!mentionedMember) {
          // Probably this user left the server.
          // We'll skip this mention (keeping the rest of the message)
          continue;
        }
        mentions.push({member: mentionedMember, count});
      }
      if (mentions.length === 0 && reactions.length === 0) {
        // No valid mentions or reactions, meaning this message won't have real Cred effects.
        // let's skip it.
        continue;
      }

      const author = memberMap.get(message.authorId) || null;

      yield {
        message,
        author,
        reactions,
        mentions,
        channelName: channel.name,
        channelId: channel.id,
        channelParentId: channel.parentId,
      };
    }
  }
}

export async function createGraph(
  config: DiscordConfig,
  repo: SqliteMirrorRepository
): Promise<WeightedGraphT> {
  return _createGraphFromMessages(config, findGraphMessages(repo));
}

export function _createGraphFromMessages(
  config: DiscordConfig,
  messages: Iterable<GraphMessage>
): WeightedGraphT {
  const wg = {
    graph: new Graph(),
    weights: emptyWeights(),
  };
  const {guildId, weights} = config;
  const propsChannels = new Set(config.propsChannels);

  for (const graphMessage of messages) {
    const {
      message,
      author,
      reactions,
      mentions,
      channelName,
      channelId,
      channelParentId,
    } = graphMessage;

    let messageWeight = 0;
    for (const {reaction, reactingMember} of reactions) {
      const weight = reactionWeight({
        weights,
        message,
        reaction,
        reactingMember,
        propsChannels,
        reactions,
        channelParentId,
      });
      messageWeight += weight;
      if (weight && !config.simplifyGraph) {
        const node = reactionNode(reaction, message.timestampMs, guildId);
        wg.weights.nodeWeights.set(node.address, weight);
        wg.graph.addNode(node);
        wg.graph.addNode(memberNode(reactingMember));
        wg.graph.addEdge(reactsToEdge(reaction, message));
        wg.graph.addEdge(
          addsReactionEdge(reaction, reactingMember, message.timestampMs)
        );
      }
    }
    if (!messageWeight) continue;

    if (author) {
      wg.graph.addNode(memberNode(author));
      wg.graph.addEdge(authorsMessageEdge(message, author));
    }
    wg.graph.addNode(messageNode(message, guildId, channelName));
    if (config.simplifyGraph)
      wg.weights.nodeWeights.set(messageAddress(message), messageWeight);

    for (const {member, count} of mentions) {
      wg.graph.addNode(memberNode(member));
      let edge;
      if (propsChannels.has(channelId)) {
        edge = propsEdge(message, member);
      } else {
        edge = mentionsEdge(message, member);
      }
      wg.graph.addEdge(edge);
      if (count > 1)
        wg.weights.edgeWeights.set(edge.address, {
          forwards: count,
          backwards: 1,
        });
    }
  }

  return wg;
}

export function* createContributions(
  repo: SqliteMirrorRepository,
  configsByTarget: $ReadOnlyArray<Config>
): Iterable<Contribution> {
  const earliestStartTimeMs = configsByTarget.reduce(
    (result, next) => (next.startTimeMs < result ? next.startTimeMs : result),
    Infinity
  );
  for (const msg of findGraphMessages(repo)) {
    if (msg.message.timestampMs < earliestStartTimeMs) continue;
    const reactionsGroupedByReacter: Map<
      Model.GuildMember,
      Array<GraphReaction>
    > = msg.reactions.reduce((accumulator, reaction) => {
      if (reaction.reactingMember.user.id === msg.author?.user.id)
        return accumulator;
      const reactions = accumulator.get(reaction.reactingMember);
      if (!reactions) accumulator.set(reaction.reactingMember, [reaction]);
      else reactions.push(reaction);
      return accumulator;
    }, new Map());
    const reactingMemberExpressions: Array<Expression> = [];
    for (const [reacter, reactions] of reactionsGroupedByReacter.entries()) {
      const roleExpression = {
        operator: "MAX",
        description: "reacting member roles",
        weightOperands: reacter.roles.map((role) => ({
          key: keys.ROLE,
          subkey: role,
        })),
        expressionOperands: [],
      };
      const emojiExpression = {
        operator: "key:" + keys.REACTIONS_OF_SINGLE_PARTICIPANT,
        description: "emojis from a single participant",
        weightOperands: reactions.map((r) => ({
          key: keys.EMOJI,
          subkey: Model.emojiToRef(r.reaction.emoji),
        })),
        expressionOperands: [],
      };
      reactingMemberExpressions.push({
        operator: "MULTIPLY",
        description: "reactions from a single participant",
        weightOperands: [],
        expressionOperands: [roleExpression, emojiExpression],
      });
    }
    const expression: Expression = {
      operator: "MULTIPLY",
      description: "message attributes",
      weightOperands: [],
      expressionOperands: [
        {
          operator: "key:" + keys.REACTIONS_ACROSS_PARTICIPANTS,
          description: "reacting members",
          weightOperands: [],
          expressionOperands: reactingMemberExpressions,
        },
        {
          operator: "FIRST",
          description: "channel or category",
          weightOperands: [
            {key: keys.CHANNEL, subkey: msg.channelId},
            {key: keys.CATEGORY, subkey: msg.channelParentId ?? ""},
          ],
          expressionOperands: [],
        },
      ],
    };
    const participants = msg.mentions
      .filter((m) => m.count)
      .flatMap((m) => {
        const shares = [];
        for (let i = 0; i < m.count; i++) {
          shares.push({key: keys.MENTION, subkey: msg.channelId});
        }
        return {
          id: NodeAddress.fromRaw(memberAddress(m.member)),
          shares,
        };
      });
    if (msg.author)
      participants.push({
        id: NodeAddress.fromRaw(memberAddress(msg.author)),
        shares: [{key: keys.AUTHOR}],
      });
    yield {
      id: msg.channelId + "/" + msg.message.id,
      plugin: "discord",
      type: "message",
      timestampMs: msg.message.timestampMs,
      participants,
      expression,
    };
  }
}
