// @flow

import * as Combo from "../../util/combo";
import * as Model from "./models";
import {
  type EmojiWeightMap,
  type RoleWeightConfig,
  type ChannelWeightConfig,
} from "./createGraph";

export type {BotToken as DiscordToken} from "./models";

export type DiscordConfig = {|
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
  //   "roleWeights": {
  //     "759191073943191613": 0.5,
  //     "762085832181153872": 1,
  //     "698296035889381403": 1
  //   }
  // }
  // Note that roles use a snowflake id only.
  // defaultWeight is used to set weights for members who don't have a specified role
  +roleWeightConfig: RoleWeightConfig,
  // An object mapping a role to a weight, as in:
  // {
  //   "defaultWeight": 0,
  //   "channelWeights": {
  //     "759191073943191613": 0.25
  //   }
  // }
  // Note that roles use a snowflake id only.
  // defaultWeight is used to set weights for members who don't have a specified role
  +channelWeightConfig: ChannelWeightConfig,
|};

export const parser: Combo.Parser<DiscordConfig> = (() => {
  const C = Combo;
  return C.object({
    guildId: C.string,
    reactionWeights: C.dict(C.number),
    roleWeightConfig: C.object({
      defaultWeight: C.number,
      roleWeights: C.dict(C.number),
    }),
    channelWeightConfig: C.object({
      defaultWeight: C.number,
      channelWeights: C.dict(C.number),
    }),
  });
})();
