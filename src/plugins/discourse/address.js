// @flow

import {NodeAddress, type NodeAddressT} from "../../core/graph";

import {type PostId, type TopicId} from "./fetch";

import {topicNodeType, postNodeType, userNodeType} from "./declaration";

export function topicAddress(serverUrl: string, id: TopicId): NodeAddressT {
  return NodeAddress.append(topicNodeType.prefix, serverUrl, String(id));
}
export function postAddress(serverUrl: string, id: PostId): NodeAddressT {
  return NodeAddress.append(postNodeType.prefix, serverUrl, String(id));
}
export function userAddress(serverUrl: string, username: string): NodeAddressT {
  return NodeAddress.append(userNodeType.prefix, serverUrl, username);
}
