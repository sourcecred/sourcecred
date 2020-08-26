// @flow

import {NodeAddress, type NodeAddressT} from "../../core/graph";

import {userNodeType, postNodeType, commentNodeType} from "./declaration";

import {type PostActivityId, type CommentId, type Username} from "./fetch";

export function userAddress(
  serverUrl: string,
  username: Username
): NodeAddressT {
  // TODO: potentially add userID
  return NodeAddress.append(
    userNodeType.prefix, // [sourceCred, gitcoin, user]
    serverUrl,
    String(username)
  );
}

export function postAddress(
  serverUrl: string,
  postId: PostActivityId
): NodeAddressT {
  return NodeAddress.append(
    postNodeType.prefix, // [sourceCred, gitcoin, post]
    serverUrl,
    String(postId)
  );
}

export function commentAddress(
  serverUrl: string,
  commentId: CommentId
): NodeAddressT {
  return NodeAddress.append(
    commentNodeType.prefix, // [sourceCred, gitcoin, comment]
    serverUrl,
    String(commentId)
  );
}
