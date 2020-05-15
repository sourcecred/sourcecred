// @flow

import type {NodeAddressT, EdgeAddressT} from "../../core/graph";
import {NodeAddress, EdgeAddress} from "../../core/graph";
import {type Snowflake} from "./models";
import {
  userNodeType,
  messageNodeType,
  sentMessageEdgeType,
} from "./declaration";

/**
 * These user IDs are considered globally unique by Discord.
 * We can reference a user even across multiple guilds using this address.
 * See https://discordapp.com/api/users/{userId}
 *
 * Importantly we don't include any membership details in the address.
 * This way the graph topology stays identical when users leave / rejoin.
 */
export function userAddress(userId: Snowflake): NodeAddressT {
  return NodeAddress.append(userNodeType.prefix, userId);
}

/**
 * The URLs Discord creates to permalink these are:
 * https://discordapp.com/channels/{guildId}/{channelId}/{messageId}
 * Meanwhile the API retrieves these using:
 * https://discordapp.com/api/channels/{channelId}/messages/{messageId}
 *
 * In other words the API finds just {channelId} sufficiently namespaced for unique messages.
 * They're being conservative for the permalinks by namespacing as {guildId}/{channelId}.
 * As they've clearly not felt the need to change the API, we'll use just {channelId} too.
 */
export function messageAddress(
  channelId: Snowflake,
  messageId: Snowflake
): NodeAddressT {
  return NodeAddress.append(messageNodeType.prefix, channelId, messageId);
}

/**
 * Importantly we don't include any membership details in the address.
 * This way the graph topology stays identical when users leave / rejoin.
 */
export function sentMessageAddress(
  userId: Snowflake,
  channelId: Snowflake,
  messageId: Snowflake
): EdgeAddressT {
  return EdgeAddress.append(
    sentMessageEdgeType.prefix,
    userId,
    channelId,
    messageId
  );
}
