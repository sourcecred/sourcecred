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
  memberNodeType, messageNodeType, reactionNodeType, authorsMessageEdgeType, addsReactionEdgeType, reactsToEdgeType, mentionsEdgeType, messageRepliesEdgeType
} from "./declaration.js";
import * as Model from "./models.js"
import {type WeightConfig, reactionWeight} from "./reactionWeights";

const MESSAGE_LENGTH = 30;

//----------------------
/**
 * Addresses
 */
//----------------------

export function userAddress(userId: Buffer): NodeAddressT {
  return NodeAddress.append(memberNodeType.prefix, "user", userId);
}

export function memberAddress(member: Model.User): NodeAddressT {
  return NodeAddress.append(
    memberNodeType.prefix,
    member.id
  );
}

function messageAddress(message: Model.Message): NodeAddressT {
  return NodeAddress.append(
    messageNodeType.prefix,
    message.channel,
    message.id
  );
}

function reactionAddress(reaction: string, message: Model.Message): NodeAddressT {
  // Hacky order, so we can boost categories.
  return NodeAddress.append(
    reactionNodeType.prefix,
    message.channel,
    reaction,
    message.authorId,
    message.id
  );
}


//----------------------
/**
 * Nodes
 */
//----------------------

function memberNode(member: Model.User): Node {
  const description = `slack/${escape(member.user.username.slice(0, 20))}#${
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
  channelName: string
): Node {
  // const url = messageUrl(guild, message.channelId, message.id);
  const partialMessage = escape(message.text.substring(0, MESSAGE_LENGTH));
  const description = `#${channelName} message ["${partialMessage}..."]`;
  return {
    address: messageAddress(message),
    description,
    timestampMs: message.id,
  };
}

function reactionNode(
  message: Model.Message,
  reaction: string
): Node {
  // const msgUrl = messageUrl(guild, reaction.channelId, reaction.messageId);
  const reactionStr = reaction
  const description = `Reacted \`${reactionStr}\` to message [${message.id}] in channel ${message.channel}`;
  return {
    address: reactionAddress(reaction, message),
    description
  };
}

//----------------------
/**
 * Edges
 */
//----------------------

function authorsMessageEdge(
  message: Model.Message,
  author: Model.User
): Edge {
  const address: EdgeAddressT = EdgeAddress.append(
    authorsMessageEdgeType.prefix,
    author.id,
    message.channel,
    message.id
  );
  return {
    address,
    timestampMs: message.timestampMs,
    src: memberAddress(author),
    dst: messageAddress(message),
  };
}

function addsReactionEdge(
  reaction: string,
  member: Model.User,
  message: Model.Message
): Edge {
  const address: EdgeAddressT = EdgeAddress.append(
    addsReactionEdgeType.prefix,
    member.id,
    reaction,
    message.channel,
    message.id
  );
  return {
    address,
    // TODO: for now using timestamp of the message,
    // as reactions don't have timestamps.
    timestampMs: message.id,
    src: memberAddress(member),
    dst: reactionAddress(reaction, message),
  };
}

function reactsToEdge(reaction: string, message: Model.Message): Edge {
  const address: EdgeAddressT = EdgeAddress.append(
    reactsToEdgeType.prefix,
    reaction,
    message.authorId,
    message.channel,
    message.id
  );
  return {
    address,
    // TODO: for now using timestamp of the message,
    // as reactions don't have timestamps.
    timestampMs: message.timestampMs,
    src: reactionAddress(reaction, message),
    dst: messageAddress(message),
  };
}

function mentionsEdge(message: Model.Message, member: Model.User): Edge {
  const address: EdgeAddressT = EdgeAddress.append(
    mentionsEdgeType.prefix,
    message.channel,
    message.authorId,
    message.id,
    member.id
  );
  return {
    address,
    timestampMs: message.id,
    src: messageAddress(message),
    dst: memberAddress(member),
  };
}

function repliesEdge(message: Model.message, reply: Model.message): Edge {
  const address: EdgeAddressT = EdgeAddress.append(
    messageRepliesEdgeType.prefix,
    message.channel, 
    message.authorId,
    message.id, 
    reply.channel,
    reply.authorId, 
    reply.id
  );
  return {
    address, 
    timestampMs: message.id, 
    src: messageAddress(message), 
    dst: messageAddress(reply)
  };
}

export function createGraph(
  token: Model.SlackToken,
  repo: SqliteMirrorRepository,
  weights: WeightConfig
): WeightedGraphT {
  const wg = {
    graph: new Graph(),
    weights: emptyWeights(),
  };
  
  // create a member map from fetched members
  const memberMap = new Map(repo.members().map((m) => [m.id, m]));

  //fetch all channels (conversations)
  const channels = repo.channels();
  
  for (const channel of channels) {
    // fetch all messages of the channel
    const messages = repo.messages(channel.id);
    for (const message of messages) {
      if (!message.hasReactions && !message.hasMentions) continue;
      
      let hasEdges = false;
      const reactions = repo.reactions(message.channel, message.id);

      for (const reaction of reactions) {
        const reactingMember = memberMap.get(reaction.reactor);
        if (!reactingMember) continue;

        const node = reactionNode(message, reaction);
        wg.weights.nodeWeights.set(
          node.address,
          reactionWeight(weights, reaction.reaction, reaction.reactor, message.authorId, message.channel)
        );

        wg.graph.addNode(node);
        wg.graph.addNode(memberNode(reactingMember));
        wg.graph.addEdge(reactsToEdge(reaction.reaction, message));
        wg.graph.addEdge(addsReactionEdge(reaction.reaction, reactingMember, message));
        hasEdges = true;
      }

      for (const user of message.mentions) {
        const mentionedMember = memberMap.get(user);
        if (!mentionedMember) continue;
        wg.graph.addNode(memberNode(mentionedMember));
        wg.graph.addEdge(mentionsEdge(message, mentionedMember));
        hasEdges = true;
      }

      // message is either a thread starter or part of a thread
      if (message.isThread) {
        // @todo: need to create edge for replies
        // @question: how to fetch only threaded replies and only once?
      }

      // Don't bloat the graph with isolated messages.
      if (hasEdges) {
        const author = memberMap.get(message.authorId);
        if (!author) continue;
        wg.graph.addNode(memberNode(author));
        wg.graph.addNode(messageNode(message, channel.name));
        wg.graph.addEdge(authorsMessageEdge(message, author));
      }

    }
  }

}
