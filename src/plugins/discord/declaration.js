// @flow

import deepFreeze from "deep-freeze";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import type {NodeType, EdgeType} from "../../analysis/types";
import {NodeAddress, EdgeAddress} from "../../core/graph";

export const nodePrefix = NodeAddress.fromParts(["sourcecred", "discord"]);
export const edgePrefix = EdgeAddress.fromParts(["sourcecred", "discord"]);

export const memberNodeType: NodeType = deepFreeze({
  name: "Member",
  pluralName: "Members",
  prefix: NodeAddress.append(nodePrefix, "member"),
  defaultWeight: 0,
  description: "A member of the Discord server",
});

export const messageNodeType: NodeType = deepFreeze({
  name: "Message",
  pluralName: "Messages",
  prefix: NodeAddress.append(nodePrefix, "message"),
  defaultWeight: 0,
  description: "A Discord message, posted in a particular channel",
});

export const reactionNodeType: NodeType = deepFreeze({
  name: "Reaction",
  pluralName: "Reactions",
  prefix: NodeAddress.append(nodePrefix, "reaction"),
  defaultWeight: 0,
  description: "A reaction by some user, directed at some message",
});

export const authorsMessageEdgeType: EdgeType = deepFreeze({
  forwardName: "authors message",
  backwardName: "message is authored by",
  prefix: EdgeAddress.append(edgePrefix, "authors", "message"),
  defaultWeight: {forwards: 1 / 4, backwards: 1},
  description: "Connects an author to a message they've created.",
});

export const addsReactionEdgeType: EdgeType = deepFreeze({
  forwardName: "adds reaction",
  backwardName: "reaction added by",
  prefix: EdgeAddress.append(edgePrefix, "createsReaction"),
  defaultWeight: {forwards: 1, backwards: 1 / 16},
  description: "Connects a member to a reaction that they added.",
});

export const reactsEdgeType: EdgeType = deepFreeze({
  forwardName: "reacts to",
  backwardName: "is reacted to by",
  prefix: EdgeAddress.append(edgePrefix, "likes"),
  defaultWeight: {forwards: 1, backwards: 1 / 16},
  description: "Connects a Discord reaction to a message that it reacts to.",
});

export const declaration: PluginDeclaration = deepFreeze({
  name: "Discord",
  nodePrefix,
  edgePrefix,
  nodeTypes: [memberNodeType, messageNodeType, reactionNodeType],
  edgeTypes: [authorsMessageEdgeType, addsReactionEdgeType, reactsEdgeType],
  userTypes: [memberNodeType],
});
