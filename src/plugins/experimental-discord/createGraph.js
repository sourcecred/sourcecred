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

/* This function creates edges and nodes for discord reactions.

By default weights for all reactions are linear. Setting the 
useAsymptoticReactionWeights flag makes the weights of multiple reactions
given by the same member dropoff exponentially by powers of 2 */
function createReactionEdgesAndNodes({
  guild,
  emojiWeights,
  roleWeightConfig,
  channelWeightConfig,
  wg,
  memberMap,
  message,
  reactions,
  hasEdges,
  useAsymptoticReactionWeights,
}): boolean {
  for (const [index, reaction] of reactions.entries()) {
    const emojiRef = Model.emojiToRef(reaction.emoji);
    let reactionWeight = NullUtil.orElse(emojiWeights[emojiRef], 1);
    if (useAsymptoticReactionWeights) {
      // drop off reactionWeight by powers of 2
      reactionWeight *= 0.5 ** index;
    }

    const reactingMember = memberMap.get(reaction.authorId);
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

    // get the weight of a given channel
    const channelWeights = channelWeightConfig.channelWeights;
    const channelWeight = NullUtil.orElse(
      channelWeights[reaction.channelId],
      channelWeightConfig.defaultWeight
    );

    const node = reactionNode(reaction, message.timestampMs, guild);
    wg.weights.nodeWeights.set(
      node.address,
      channelWeight * roleWeight * reactionWeight
    );
    wg.graph.addNode(node);
    wg.graph.addNode(memberNode(reactingMember));
    wg.graph.addEdge(reactsToEdge(reaction, message));
    wg.graph.addEdge(
      addsReactionEdge(reaction, reactingMember, message.timestampMs)
    );
    hasEdges = true;
  }
  return hasEdges;
}

/* This function prepares data fetched in the createGraph function for asymptotic
dropoff in weights for multiple reactions from a single member.

The reactions fetched in the createGraph function are sorted from highest to lowest,
and separated into sub arrays of reactions grouped by reacting member.

Each of these member specific reaction arrays are then run through the createReactionEdgesAndNodes
function */
function prepareAsymptoticReactionWeights(args): boolean {
  const {emojiWeights, reactions} = args;
  let {hasEdges} = args;
  // sort reactions from highest to lowest weight emojis
  const sortedReactions = [...reactions].sort((a, b) => {
    const bEmojiWeight = NullUtil.orElse(
      emojiWeights[Model.emojiToRef(b.emoji)],
      1
    );
    const aEmojiWeight = NullUtil.orElse(
      emojiWeights[Model.emojiToRef(a.emoji)],
      1
    );
    return bEmojiWeight - aEmojiWeight;
  });

  // separate reactions into groups per member (retains sorted order)
  const memberIdToReactionsMap = new Map();
  sortedReactions.forEach((reaction) => {
    const authorData = NullUtil.orElse(
      memberIdToReactionsMap.get(reaction.authorId),
      []
    );
    authorData.push(reaction);
    memberIdToReactionsMap.set(reaction.authorId, authorData);
  });

  for (const memberReactions of memberIdToReactionsMap.values()) {
    hasEdges = createReactionEdgesAndNodes({
      ...args,
      hasEdges,
      reactions: memberReactions,
    });
  }
  return hasEdges;
}

export type EmojiWeightMap = {[ref: Model.EmojiRef]: NodeWeight};
export type RoleWeightMap = {[ref: Model.Snowflake]: NodeWeight};
export type ChannelWeightMap = {[ref: Model.Snowflake]: NodeWeight};

export type RoleWeightConfig = {|
  +defaultWeight: number,
  +roleWeights: RoleWeightMap,
|};

export type ChannelWeightConfig = {|
  +defaultWeight: number,
  +channelWeights: ChannelWeightMap,
|};

export function createGraph(
  guild: Model.Snowflake,
  useAsymptoticReactionWeights: boolean,
  repo: SqliteMirrorRepository,
  declarationWeights: Weights,
  emojiWeights: EmojiWeightMap,
  roleWeightConfig: RoleWeightConfig,
  channelWeightConfig: ChannelWeightConfig
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

      const sharedReactionWeightsArgs = {
        guild,
        emojiWeights,
        roleWeightConfig,
        channelWeightConfig,
        wg,
        memberMap,
        message,
        reactions,
        hasEdges,
        useAsymptoticReactionWeights,
      };

      hasEdges = useAsymptoticReactionWeights
        ? prepareAsymptoticReactionWeights(sharedReactionWeightsArgs)
        : createReactionEdgesAndNodes(sharedReactionWeightsArgs);

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
