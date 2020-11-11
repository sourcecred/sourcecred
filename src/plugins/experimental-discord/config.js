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
  }
);

export type DiscordConfig = {|
  +guildId: Model.Snowflake,
  +weights: WeightConfig,
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
        // TODO: Make the default emoji weight customizable
        defaultWeight: 1,
      },
    },
  };
}

export const parser: C.Parser<DiscordConfig> = C.fmap(parserJson, _upgrade);
