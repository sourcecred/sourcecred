// @flow

import deepFreeze from "deep-freeze";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import type {NodeType, EdgeType} from "../../analysis/types";
import {NodeAddress, EdgeAddress} from "../../core/graph";

export const nodePrefix = NodeAddress.fromParts(["sourcecred", "discord"]);
export const edgePrefix = EdgeAddress.fromParts(["sourcecred", "discord"]);

export const userNodeType: NodeType = deepFreeze({
  name: "User",
  pluralName: "Users",
  prefix: NodeAddress.append(nodePrefix, "USER"),
  defaultWeight: 0,
  description: "A Discord user, regardless of whether they're a server member.",
});

export const messageNodeType: NodeType = deepFreeze({
  name: "Message",
  pluralName: "Messages",
  prefix: NodeAddress.append(nodePrefix, "MESSAGE"),
  defaultWeight: 0,
  description: "A Discord message, sent in a particular channel.",
});

/*
  Note on the forward and backward naming convention.
  It follows the core/graph.js documentation to use
  a <subject> <verb> <object> format to figure out
  the directionality.
*/

/**
 * A User (src) SENT MESSAGE (verb) Message (dst).
 */
export const sentMessageEdgeType: EdgeType = deepFreeze({
  forwardName: "sent message",
  backwardName: "message is sent by",
  prefix: EdgeAddress.append(edgePrefix, "SENT_MESSAGE"),
  defaultWeight: {forwards: 1 / 32, backwards: 1},
  description: "Connects a user to a message they've sent.",
});

export const declaration: PluginDeclaration = deepFreeze({
  name: "Discord",
  nodePrefix,
  edgePrefix,
  nodeTypes: [userNodeType, messageNodeType],
  edgeTypes: [sentMessageEdgeType],
  userTypes: [userNodeType],
});
