// @flow

import {EdgeAddress, type Node, type Edge} from "../../core/graph";
import {type PostId, type Post, type Topic, type LikeAction} from "./fetch";
import {
  authorsPostEdgeType,
  authorsTopicEdgeType,
  postRepliesEdgeType,
  topicContainsPostEdgeType,
  topicHasLikedPostEdgeType,
  likesEdgeType,
  createsLikeEdgeType,
  referencesTopicEdgeType,
  referencesUserEdgeType,
  referencesPostEdgeType,
} from "./declaration";
import {userAddress, topicAddress, postAddress, likeAddress} from "./address";
import {
  type DiscourseTopicReference,
  type DiscourseUserReference,
} from "./references";

export function userNode(serverUrl: string, username: string): Node {
  const url = `${serverUrl}/u/${username}/`;
  const description = `discourse/[@${username}](${url})`;
  return {
    address: userAddress(serverUrl, username),
    description,
    timestampMs: null,
  };
}

export function topicNode(serverUrl: string, topic: Topic): Node {
  const url = `${serverUrl}/t/${String(topic.id)}`;
  const description = `[${topic.title}](${url})`;
  const address = topicAddress(serverUrl, topic.id);
  return {address, description, timestampMs: topic.timestampMs};
}

export function postNode(
  serverUrl: string,
  post: Post,
  description: string
): Node {
  const address = postAddress(serverUrl, post.id);
  return {timestampMs: post.timestampMs, address, description};
}

export function likeNode(
  serverUrl: string,
  like: LikeAction,
  postDescription: string
): Node {
  const address = likeAddress(serverUrl, like);
  const description = `❤️ by ${like.username} on ${postDescription}`;
  return {timestampMs: like.timestampMs, address, description};
}

export function authorsTopicEdge(serverUrl: string, topic: Topic): Edge {
  const address = EdgeAddress.append(
    authorsTopicEdgeType.prefix,
    serverUrl,
    topic.authorUsername,
    String(topic.id)
  );
  return {
    address,
    timestampMs: topic.timestampMs,
    src: userAddress(serverUrl, topic.authorUsername),
    dst: topicAddress(serverUrl, topic.id),
  };
}

export function authorsPostEdge(serverUrl: string, post: Post): Edge {
  const address = EdgeAddress.append(
    authorsPostEdgeType.prefix,
    serverUrl,
    post.authorUsername,
    String(post.id)
  );
  return {
    address,
    timestampMs: post.timestampMs,
    src: userAddress(serverUrl, post.authorUsername),
    dst: postAddress(serverUrl, post.id),
  };
}

export function topicContainsPostEdge(serverUrl: string, post: Post): Edge {
  const address = EdgeAddress.append(
    topicContainsPostEdgeType.prefix,
    serverUrl,
    String(post.topicId),
    String(post.id)
  );
  return {
    address,
    timestampMs: post.timestampMs,
    src: topicAddress(serverUrl, post.topicId),
    dst: postAddress(serverUrl, post.id),
  };
}

export function topicHasLikedPostEdge(serverUrl: string, post: Post): Edge {
  const address = EdgeAddress.append(
    topicHasLikedPostEdgeType.prefix,
    serverUrl,
    String(post.topicId),
    String(post.id)
  );
  return {
    address,
    timestampMs: post.timestampMs,
    src: topicAddress(serverUrl, post.topicId),
    dst: postAddress(serverUrl, post.id),
  };
}

export function postRepliesEdge(
  serverUrl: string,
  post: Post,
  basePostId: PostId
): Edge {
  const address = EdgeAddress.append(
    postRepliesEdgeType.prefix,
    serverUrl,
    String(post.id),
    String(basePostId)
  );
  return {
    address,
    timestampMs: post.timestampMs,
    src: postAddress(serverUrl, post.id),
    dst: postAddress(serverUrl, basePostId),
  };
}

export function createsLikeEdge(serverUrl: string, like: LikeAction): Edge {
  const address = EdgeAddress.append(
    createsLikeEdgeType.prefix,
    serverUrl,
    like.username,
    String(like.postId)
  );
  return {
    address,
    timestampMs: like.timestampMs,
    src: userAddress(serverUrl, like.username),
    dst: likeAddress(serverUrl, like),
  };
}

export function likesEdge(serverUrl: string, like: LikeAction): Edge {
  const address = EdgeAddress.append(
    likesEdgeType.prefix,
    serverUrl,
    like.username,
    String(like.postId)
  );
  return {
    address,
    timestampMs: like.timestampMs,
    src: likeAddress(serverUrl, like),
    dst: postAddress(serverUrl, like.postId),
  };
}

export function referencesTopicEdge(
  serverUrl: string,
  post: Post,
  reference: DiscourseTopicReference
): Edge {
  const address = EdgeAddress.append(
    referencesTopicEdgeType.prefix,
    serverUrl,
    String(post.id),
    String(reference.topicId)
  );
  const src = postAddress(serverUrl, post.id);
  const dst = topicAddress(serverUrl, reference.topicId);
  return {src, dst, timestampMs: post.timestampMs, address};
}

export function referencesPostEdge(
  serverUrl: string,
  post: Post,
  referredPostId: PostId
): Edge {
  const address = EdgeAddress.append(
    referencesPostEdgeType.prefix,
    serverUrl,
    String(post.id),
    String(referredPostId)
  );
  const src = postAddress(serverUrl, post.id);
  const dst = postAddress(serverUrl, referredPostId);
  return {src, dst, timestampMs: post.timestampMs, address};
}

export function referencesUserEdge(
  serverUrl: string,
  post: Post,
  reference: DiscourseUserReference
): Edge {
  const address = EdgeAddress.append(
    referencesUserEdgeType.prefix,
    serverUrl,
    String(post.id),
    reference.username
  );
  const src = postAddress(serverUrl, post.id);
  const dst = userAddress(serverUrl, reference.username);
  return {src, dst, timestampMs: post.timestampMs, address};
}
