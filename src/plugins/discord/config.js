// @flow

import * as NullUtil from "../../util/null";
import * as C from "../../util/combo";
import * as Model from "./models";
import {
  type EmojiWeightMap,
  type RoleWeightConfig,
  type ChannelWeightConfig,
  type WeightConfig,
} from "./reactionWeights";

export type {BotToken as DiscordToken} from "./models";

/**
 * The serialized form of the Discord config.
 * If you are editing a config.json file, it should match this type.
 *
 * TODO: This type is kind of disorganized. It would be cleaner to have all the
 * weight configuration in single optional sub-object, I think. Consider
 * cleaning up before 0.8.0.
 */
export type DiscordConfigJson = {|
  // Id of the Discord server.
  // To get the ID, go into your Discord settings and under "Appearance",
  // go to the "Advanced" section and enable "Developer Mode".
  // Then right click on the server icon and choose "copy ID".
  +guildId: Model.Snowflake,
  // An object mapping a reaction to a weight, as in:
  // {
  //   "🥰": 16,
  //   "sourcecred:626763367893303303": 32,
  // }
  // Note that server custom emojis have a snowflake identifier.
  //
  // You can get a custom emoji ID by right clicking the custom emoji and
  // copying it's URL, with the ID being the image file name.
  +reactionWeights: EmojiWeightMap,
  // An object mapping a role to a weight, as in:
  // {
  //   "defaultWeight": 0,
  //   "weights": {
  //     "759191073943191613": 0.5,
  //     "762085832181153872": 1,
  //     "698296035889381403": 1
  //   }
  // }
  // Note that roles use a snowflake id only.
  // defaultWeight is used to set weights for members who don't have a specified role
  +roleWeightConfig?: RoleWeightConfig,
  // An object mapping a channel to a weight, as in:
  // {
  //   "defaultWeight": 0,
  //   "weights": {
  //     "759191073943191613": 0.25
  //   }
  // }
  // Note that channels use a snowflake id only.
  // defaultWeight is used to set weights for channels that don't have a specified weight
  +channelWeightConfig?: ChannelWeightConfig,
  // List of channels which are considered "props channels".
  // In a props channel, we have an extra rule: if someone is mentioned in a message,
  // we create a "props" edge to the mentioned user instead of a regular "mentions" edge.
  // We can set a higher weight on these props edges, which allows us to flow Cred in a props
  // mostly to the people receiving props, rather than to the author of the props message.
  +propsChannels?: $ReadOnlyArray<Model.Snowflake>,
  // Whether to include NSFW channels in cred distribution or not
  +includeNsfwChannels?: boolean,
  // What the weight should be for reactions not specified in reactionWeights
  +defaultReactionWeight?: number,
  // Whether reaction weights on a given message should be divided by the number
  // of unique members that reacted to the message.
  +applyAveragingToReactions?: boolean,
|};

const parserJson: C.Parser<DiscordConfigJson> = C.object(
  {
    guildId: C.string,
    reactionWeights: C.dict(C.number),
  },
  {
    roleWeightConfig: C.object({
      defaultWeight: C.number,
      weights: C.dict(C.number),
    }),
    channelWeightConfig: C.object({
      defaultWeight: C.number,
      weights: C.dict(C.number),
    }),
    propsChannels: C.array(C.string),
    includeNsfwChannels: C.boolean,
    defaultReactionWeight: C.number,
    applyAveragingToReactions: C.boolean,
  }
);

export type DiscordConfig = {|
  +guildId: Model.Snowflake,
  +weights: WeightConfig,
  +propsChannels: $ReadOnlyArray<Model.Snowflake>,
  +includeNsfwChannels: boolean,
|};

/**
 * Upgrade from the version on disk to the DiscordConfig.
 *
 * For now, this allows us to refactor to a cleaner internal type without breaking any existing users.
 * We may need this indefinitely if e.g. we decide to de-serialize the raw JSON into maps (since maps
 * can't be written directly to JSON).
 */
export function _upgrade(json: DiscordConfigJson): DiscordConfig {
  const defaultRoleWeights = {defaultWeight: 1, weights: {}};
  const defaultChannelWeights = {defaultWeight: 1, weights: {}};
  return {
    guildId: json.guildId,
    weights: {
      roleWeights: NullUtil.orElse(json.roleWeightConfig, defaultRoleWeights),
      channelWeights: NullUtil.orElse(
        json.channelWeightConfig,
        defaultChannelWeights
      ),
      emojiWeights: {
        weights: json.reactionWeights,
        defaultWeight: NullUtil.orElse(json.defaultReactionWeight, 1),
        applyAveraging: NullUtil.orElse(json.applyAveragingToReactions, false),
      },
    },
    propsChannels: json.propsChannels || [],
    includeNsfwChannels: json.includeNsfwChannels || false,
  };
}

export const parser: C.Parser<DiscordConfig> = C.fmap(parserJson, _upgrade);
