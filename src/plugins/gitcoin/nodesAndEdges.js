// @flow
import {EdgeAddress, type Node, type Edge} from "../../core/graph";

import {userAddress, postAddress, commentAddress} from "./address";

import {
  createsCommentEdgeType,
  createsPostEdgeType,
  likesPostEdgeType,
  likesCommentEdgeType,
  postHasReplyEdgeType,
  tipsPostEdgeType,
} from "./declaration";

import {
  type User,
  type Comment,
  type PostActivity,
  type PostLike,
  type CommentLike,
} from "./fetch";

export function userNode(serverUrl: string, user: User): Node {
  let description;

  if (user.name !== null) {
    description = `user/${user.name}`;
  } else {
    description = `user/${user.id}`;
  }

  return {
    address: userAddress(serverUrl, user.name),
    description,
    timestampMs: user.timestampMs,
  };
}

export function postNode(serverUrl: string, post: PostActivity): Node {
  const description = `post/${post.id}`;

  return {
    address: postAddress(serverUrl, post.id),
    description,
    timestampMs: post.timestampMs,
  };
}

export function commentNode(serverUrl: string, comment: Comment): Node {
  const description = `comment/${comment.id}`;

  return {
    address: commentAddress(serverUrl, comment.id),
    description,
    timestampMs: comment.timestampMs,
  };
}

export function createCommentEdge(serverUrl: string, comment: Comment): Edge {
  const address = EdgeAddress.append(
    createsCommentEdgeType.prefix,
    serverUrl,
    String(comment.id)
  );

  return {
    address,
    src: userAddress(serverUrl, comment.authorUsername),
    dst: commentAddress(serverUrl, comment.id),
    timestampMs: comment.timestampMs,
  };
}

export function createsPostEdge(serverUrl: string, post: PostActivity): Edge {
  const address = EdgeAddress.append(
    createsPostEdgeType.prefix,
    serverUrl,
    String(post.id)
  );

  return {
    address,
    src: userAddress(serverUrl, post.authorUsername),
    dst: postAddress(serverUrl, post.id),
    timestampMs: post.timestampMs,
  };
}

export function createLikePostEdge(serverUrl: string, like: PostLike): Edge {
  const address = EdgeAddress.append(
    likesPostEdgeType.prefix,
    serverUrl,
    String(like.postId)
  );

  return {
    address,
    src: userAddress(serverUrl, like.authorUsername),
    dst: postAddress(serverUrl, like.postId),
    timestampMs: like.timestampMs,
  };
}

export function createLikeCommentEdge(
  serverUrl: string,
  like: CommentLike
): Edge {
  const address = EdgeAddress.append(
    likesCommentEdgeType.prefix,
    serverUrl,
    String(like.id)
  );

  return {
    address,
    src: userAddress(serverUrl, like.authorUsername),
    dst: commentAddress(serverUrl, like.commentId ? like.commentId : 1234),
    timestampMs: like.timestampMs,
  };
}

export function createPostHasReplyEdge(
  serverUrl: string,
  comment: Comment
): Edge {
  const address = EdgeAddress.append(
    postHasReplyEdgeType.prefix,
    serverUrl,
    String(comment.id)
  );

  return {
    address,
    src: commentAddress(serverUrl, comment.id),
    dst: postAddress(serverUrl, comment.postId),
    timestampMs: comment.timestampMs,
  };
}

export function tipsPostEdge(serverUrl: string, post: PostActivity): Edge {
  const address = EdgeAddress.append(
    tipsPostEdgeType.prefix,
    serverUrl,
    String(post.id)
  );

  return {
    address,
    src: userAddress(serverUrl, post.authorUsername),
    dst: postAddress(serverUrl, post.id),
    timestampMs: post.timestampMs,
  };
}
