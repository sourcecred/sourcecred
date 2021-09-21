// @flow

import * as Model from "./models";
import * as NullUtil from "../../util/null";
import {type NodeWeight} from "../../core/weights";
import {type GraphReaction} from "./createGraph";

export type RoleWeightConfig = {|
  +defaultWeight: NodeWeight,
  +weights: {[Model.Snowflake]: NodeWeight},
|};

export type ChannelWeightConfig = {|
  +defaultWeight: NodeWeight,
  // May contain channel IDs or channel category IDs
  +weights: {[Model.Snowflake]: NodeWeight},
|};

export type EmojiWeightMap = {[Model.Snowflake]: NodeWeight};
export type ReactionWeightConfig = {|
  +weights: EmojiWeightMap,
  +defaultWeight: NodeWeight,
  +applyAveraging: boolean,
  +confidenceDampener?: number,
|};

export type WeightConfig = {|
  +roleWeights: RoleWeightConfig,
  +channelWeights: ChannelWeightConfig,
  +emojiWeights: ReactionWeightConfig,
|};

export function reactionWeight(
  weights: WeightConfig,
  message: Model.Message,
  reaction: Model.Reaction,
  reactingMember: Model.GuildMember,
  propsChannels: Set<Model.Snowflake>,
  reactions: $ReadOnlyArray<GraphReaction>,
  channelParentId: ?Model.Snowflake
): NodeWeight {
  if (
    message.authorId === reaction.authorId &&
    !propsChannels.has(message.channelId)
  ) {
    // Self-reactions do not mint Cred
    // on channels that are not props channels
    return 0;
  }

  const roleMultipliedReactingMembers = weights.emojiWeights.applyAveraging
    ? Array.from(
        new Set(
          reactions
            .filter(({reaction}) => reaction.authorId !== message.authorId)
            .map(({reactingMember}) => reactingMember)
        )
      ).reduce(
        (total, member) => total + _roleWeight(weights.roleWeights, member),
        0
      ) + (weights.emojiWeights.confidenceDampener || 0)
    : null;
  const averagingMultiplier = roleMultipliedReactingMembers
    ? 1 / roleMultipliedReactingMembers
    : 1;

  return (
    _roleWeight(weights.roleWeights, reactingMember) *
    _channelWeight(weights.channelWeights, reaction, channelParentId) *
    _emojiWeight(weights.emojiWeights, reaction) *
    averagingMultiplier
  );
}

export function _roleWeight(
  config: RoleWeightConfig,
  member: Model.GuildMember
): NodeWeight {
  const {defaultWeight, weights} = config;
  let weight = defaultWeight;
  for (const role of member.roles) {
    const matchingWeight = weights[role];
    if (matchingWeight != null && matchingWeight > weight) {
      weight = matchingWeight;
    }
  }
  return weight;
}

export function _channelWeight(
  config: ChannelWeightConfig,
  reaction: Model.Reaction,
  channelParentId: ?Model.Snowflake
): NodeWeight {
  const {defaultWeight, weights} = config;
  let parentWeight = channelParentId ? weights[channelParentId] : undefined;
  let channelWeight = weights[reaction.channelId];
  if (parentWeight === undefined && channelWeight === undefined)
    return defaultWeight * defaultWeight;
  if (channelWeight === undefined) channelWeight = defaultWeight || 1;
  if (parentWeight === undefined) parentWeight = defaultWeight || 1;
  return parentWeight * channelWeight;
}

export function _emojiWeight(
  config: ReactionWeightConfig,
  reaction: Model.Reaction
): NodeWeight {
  const {defaultWeight, weights} = config;
  return NullUtil.orElse(
    weights[Model.emojiToRef(reaction.emoji)],
    defaultWeight
  );
}
