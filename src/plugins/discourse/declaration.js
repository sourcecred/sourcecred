// @flow

import deepFreeze from "deep-freeze";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import type {NodeType, EdgeType} from "../../analysis/types";
import {NodeAddress, EdgeAddress} from "../../core/graph";

export const topicNodeType: NodeType = deepFreeze({
  name: "Topic",
  pluralName: "Topics",
  prefix: NodeAddress.fromParts(["sourcecred", "discourse", "topic"]),
  defaultWeight: 2,
  description:
    "A topic (or post-container) in a Discourse instance. Every topic has at least one post.",
});

export const postNodeType: NodeType = deepFreeze({
  name: "Post",
  pluralName: "Posts",
  prefix: NodeAddress.fromParts(["sourcecred", "discourse", "post"]),
  defaultWeight: 1,
  description: "A post in some topic in a Discourse instance.",
});

export const userNodeType: NodeType = deepFreeze({
  name: "User",
  pluralName: "Users",
  prefix: NodeAddress.fromParts(["sourcecred", "discourse", "user"]),
  defaultWeight: 1,
  description: "A user account on a particular Discourse instance.",
});

export const topicContainsPostEdgeType: EdgeType = deepFreeze({
  forwardName: "contains post",
  backwardName: "is contained by topic",
  prefix: EdgeAddress.fromParts([
    "sourcecred",
    "discourse",
    "topicContainsPost",
  ]),
  defaultWeight: {forwards: 0, backwards: 1},
  description: "Connects a topic to the posts that it contains.",
});

export const postRepliesEdgeType: EdgeType = deepFreeze({
  forwardName: "post is reply to",
  backwardName: "post replied to by",
  prefix: EdgeAddress.fromParts(["sourcecred", "discourse", "replyTo"]),
  defaultWeight: {forwards: 1, backwards: 0},
  description: "Connects a post to the post that it is a reply to.",
});

export const authorsTopicEdgeType: EdgeType = deepFreeze({
  forwardName: "authors",
  backwardName: "is authored by",
  prefix: EdgeAddress.fromParts([
    "sourcecred",
    "discourse",
    "authors",
    "topic",
  ]),
  defaultWeight: {forwards: 0.5, backwards: 1},
  description: "Connects an author to a topic they created.",
});

export const authorsPostEdgeType: EdgeType = deepFreeze({
  forwardName: "authors",
  backwardName: "is authored by",
  prefix: EdgeAddress.fromParts(["sourcecred", "discourse", "authors", "post"]),
  defaultWeight: {forwards: 0.5, backwards: 1},
  description: "Connects an author to a post they've created.",
});

export const declaration: PluginDeclaration = deepFreeze({
  name: "discourse",
  nodeTypes: [userNodeType, topicNodeType, postNodeType],
  edgeTypes: [
    postRepliesEdgeType,
    authorsTopicEdgeType,
    authorsPostEdgeType,
    topicContainsPostEdgeType,
  ],
});
