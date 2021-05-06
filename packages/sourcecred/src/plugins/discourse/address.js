// @flow

import {NodeAddress, type NodeAddressT} from "../../core/graph";

import {type PostId, type TopicId, type LikeAction} from "./fetch";

import {
  topicNodeType,
  postNodeType,
  userNodeType,
  likeNodeType,
} from "./declaration";

export function topicAddress(serverUrl: string, id: TopicId): NodeAddressT {
  return NodeAddress.append(topicNodeType.prefix, serverUrl, String(id));
}

export function postAddress(serverUrl: string, id: PostId): NodeAddressT {
  return NodeAddress.append(postNodeType.prefix, serverUrl, String(id));
}

export function userAddress(serverUrl: string, username: string): NodeAddressT {
  return NodeAddress.append(userNodeType.prefix, serverUrl, username);
}

export function likeAddress(serverUrl: string, like: LikeAction): NodeAddressT {
  return NodeAddress.append(
    likeNodeType.prefix,
    serverUrl,
    like.username,
    String(like.postId)
  );
}
