// @flow

import * as NullUtil from "../../util/null";
import {type NodeWeight} from "../../core/weights";

export type ChannelWeightConfig = {|
  +defaultWeight: NodeWeight,
  +weights: {string: NodeWeight},
|};

export type EmojiWeightConfig = {|
  +defaultWeight: NodeWeight,
  +weights: {[string]: NodeWeight},
|};

export type WeightConfig = {|
  +channelWeights: ChannelWeightConfig,
  +emojiWeights: EmojiWeightConfig,
|};

export function reactionWeight(
  weights: WeightConfig,
  reaction: string,
  reactingMember: Buffer,
  messageAuthor: Buffer,
  channelId: string
): NodeWeight {
  if (messageAuthor === reactingMember) {
    // Self-reactions do not mint Cred.
    return 0;
  }
  return (
    _channelWeight(weights.channelWeights, channelId) *
    _emojiWeight(weights.emojiWeights, reaction)
  );
}

export function _channelWeight(
  config: ChannelWeightConfig,
  channelId: string
): NodeWeight {
  const {defaultWeight, weights} = config;
  return NullUtil.orElse(weights[channelId], defaultWeight);
}

export function _emojiWeight(
  config: EmojiWeightConfig,
  reaction: string // emoji name
): NodeWeight {
  const {defaultWeight, weights} = config;
  return NullUtil.orElse(
    weights[reaction],
    defaultWeight
  );
}
