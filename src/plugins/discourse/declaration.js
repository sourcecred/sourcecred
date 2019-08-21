// @flow

import deepFreeze from "deep-freeze";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import type {NodeType, EdgeType} from "../../analysis/types";
import {NodeAddress, EdgeAddress} from "../../core/graph";

export const nodePrefix = NodeAddress.fromParts(["sourcecred", "discourse"]);
export const edgePrefix = EdgeAddress.fromParts(["sourcecred", "discourse"]);

export const topicNodeType: NodeType = deepFreeze({
  name: "Topic",
  pluralName: "Topics",
  prefix: NodeAddress.append(nodePrefix, "topic"),
  defaultWeight: 2,
  description:
    "A topic (or post-container) in a Discourse instance. Every topic has at least one post.",
});

export const postNodeType: NodeType = deepFreeze({
  name: "Post",
  pluralName: "Posts",
  prefix: NodeAddress.append(nodePrefix, "post"),
  defaultWeight: 1,
  description: "A post in some topic in a Discourse instance.",
});

export const userNodeType: NodeType = deepFreeze({
  name: "User",
  pluralName: "Users",
  prefix: NodeAddress.append(nodePrefix, "user"),
  defaultWeight: 1,
  description: "A user account on a particular Discourse instance.",
});

export const topicContainsPostEdgeType: EdgeType = deepFreeze({
  forwardName: "contains post",
  backwardName: "is contained by topic",
  prefix: EdgeAddress.append(edgePrefix, "topicContainsPost"),
  defaultWeight: {forwards: 1 / 16, backwards: 1 / 4},
  description: "Connects a topic to the posts that it contains.",
});

export const postRepliesEdgeType: EdgeType = deepFreeze({
  forwardName: "post is reply to",
  backwardName: "post replied to by",
  prefix: EdgeAddress.append(edgePrefix, "replyTo"),
  defaultWeight: {forwards: 1, backwards: 1 / 16},
  description: "Connects a post to the post that it is a reply to.",
});

export const authorsTopicEdgeType: EdgeType = deepFreeze({
  forwardName: "authors topic",
  backwardName: "topic is authored by",
  prefix: EdgeAddress.append(edgePrefix, "authors", "topic"),
  defaultWeight: {forwards: 1 / 4, backwards: 1},
  description: "Connects an author to a topic they created.",
});

export const authorsPostEdgeType: EdgeType = deepFreeze({
  forwardName: "authors post",
  backwardName: "post is authored by",
  prefix: EdgeAddress.append(edgePrefix, "authors", "post"),
  defaultWeight: {forwards: 1 / 4, backwards: 1},
  description: "Connects an author to a post they've created.",
});

export const likesEdgeType: EdgeType = deepFreeze({
  forwardName: "likes",
  backwardName: "is liked by",
  prefix: EdgeAddress.append(edgePrefix, "likes"),
  defaultWeight: {forwards: 1, backwards: 1 / 16},
  description: "Connects a Discourse user to a post they liked.",
});

export const declaration: PluginDeclaration = deepFreeze({
  name: "discourse",
  nodePrefix,
  edgePrefix,
  nodeTypes: [userNodeType, topicNodeType, postNodeType],
  edgeTypes: [
    postRepliesEdgeType,
    authorsTopicEdgeType,
    authorsPostEdgeType,
    topicContainsPostEdgeType,
    likesEdgeType,
  ],
});
