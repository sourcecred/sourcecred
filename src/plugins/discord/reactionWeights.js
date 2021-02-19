// @flow

import * as Model from "./models";
import * as NullUtil from "../../util/null";
import {type NodeWeight} from "../../core/weights";

export type RoleWeightConfig = {|
  +defaultWeight: NodeWeight,
  +weights: {[Model.Snowflake]: NodeWeight},
|};

export type ChannelWeightConfig = {|
  +defaultWeight: NodeWeight,
  +weights: {[Model.Snowflake]: NodeWeight},
|};

export type EmojiWeightMap = {[Model.Snowflake]: NodeWeight};
export type EmojiWeightConfig = {|
  +defaultWeight: NodeWeight,
  +weights: EmojiWeightMap,
|};

export type WeightConfig = {|
  +roleWeights: RoleWeightConfig,
  +channelWeights: ChannelWeightConfig,
  +emojiWeights: EmojiWeightConfig,
|};

export function reactionWeight(
  weights: WeightConfig,
  message: Model.Message,
  reaction: Model.Reaction,
  reactingMember: Model.GuildMember,
  propsChannels: Set<Model.Snowflake>
): NodeWeight {
  if (
    message.authorId === reaction.authorId &&
    !propsChannels.has(message.channelId)
  ) {
    // Self-reactions do not mint Cred
    // on channels that are not props channels
    return 0;
  }

  return (
    _roleWeight(weights.roleWeights, reactingMember) *
    _channelWeight(weights.channelWeights, reaction) *
    _emojiWeight(weights.emojiWeights, reaction)
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
  reaction: Model.Reaction
): NodeWeight {
  const {defaultWeight, weights} = config;
  return NullUtil.orElse(weights[reaction.channelId], defaultWeight);
}

export function _emojiWeight(
  config: EmojiWeightConfig,
  reaction: Model.Reaction
): NodeWeight {
  const {defaultWeight, weights} = config;
  return NullUtil.orElse(
    weights[Model.emojiToRef(reaction.emoji)],
    defaultWeight
  );
}
