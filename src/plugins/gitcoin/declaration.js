// @flow

import deepFreeze from "deep-freeze";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import type {NodeType, EdgeType} from "../../analysis/types";
import {NodeAddress, EdgeAddress} from "../../core/graph";

export const nodePrefix = NodeAddress.fromParts(["sourcecred", "gitcoin"]);
export const edgePrefix = EdgeAddress.fromParts(["sourcecred", "gitcoin"]);

export const userNodeType: NodeType = deepFreeze({
  name: "User",
  pluralName: "Users",
  prefix: NodeAddress.append(nodePrefix, "user"),
  defaultWeight: 0,
  description: "A user account on GitCoin",
});

export const postNodeType: NodeType = deepFreeze({
  name: "Post",
  pluralName: "Posts",
  prefix: NodeAddress.append(nodePrefix, "post"),
  defaultWeight: 8,
  description: "A townsquare post on GitCoin",
});

export const commentNodeType: NodeType = deepFreeze({
  name: "Comment",
  pluralName: "Comments",
  prefix: NodeAddress.append(nodePrefix, "comment"),
  defaultWeight: 4,
  description: "A comment by some user, directed at some post",
});

export const createsPostEdgeType: EdgeType = deepFreeze({
  forwardName: "creates post",
  backwardName: "post is created by",
  prefix: EdgeAddress.append(edgePrefix, "creates", "post"),
  defaultWeight: {forwards: 1, backwards: 1 / 16},
  description: "Connects a user to a post they've created",
});

export const createsCommentEdgeType: EdgeType = deepFreeze({
  forwardName: "creates comment",
  backwardName: "comment is created by",
  prefix: EdgeAddress.append(edgePrefix, "creates", "comment"),
  defaultWeight: {forwards: 1, backwards: 1 / 16},
  description: "Connects a user to a comment they've created",
});

export const likesPostEdgeType: EdgeType = deepFreeze({
  forwardName: "likes post",
  backwardName: "post is liked by",
  prefix: EdgeAddress.append(edgePrefix, "likes", "post"),
  defaultWeight: {forwards: 1, backwards: 1 / 16},
  description: "Connects a user to a post they've liked",
});

export const likesCommentEdgeType: EdgeType = deepFreeze({
  forwardName: "likes comment",
  backwardName: "comment is liked by",
  prefix: EdgeAddress.append(edgePrefix, "likes", "comment"),
  defaultWeight: {forwards: 1, backwards: 1 / 16},
  description: "Connects a user to a comment they've liked",
});

export const tipsPostEdgeType: EdgeType = deepFreeze({
  forwardName: "tips post",
  backwardName: "post is tipped by",
  prefix: EdgeAddress.append(edgePrefix, "tips", "post"),
  defaultWeight: {forwards: 1, backwards: 1 / 16},
  description: "Connects a user to a post they've tipped",
});

export const postHasReplyEdgeType: EdgeType = deepFreeze({
  forwardName: "replies to post",
  backwardName: "is replied to",
  prefix: EdgeAddress.append(edgePrefix, "has", "reply"),
  defaultWeight: {forwards: 1, backwards: 1 / 16},
  description: "Connects a comment to a post",
});

export const declaration: PluginDeclaration = deepFreeze({
  name: "Gitcoin",
  nodePrefix,
  edgePrefix,
  nodeTypes: [userNodeType, postNodeType, commentNodeType],
  edgeTypes: [
    createsPostEdgeType,
    createsCommentEdgeType,
    likesPostEdgeType,
    likesCommentEdgeType,
    tipsPostEdgeType,
    postHasReplyEdgeType,
  ],
  userTypes: [userNodeType],
});
