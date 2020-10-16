// @flow

import * as Combo from "../../util/combo";
import * as Model from "./models";
import {type EmojiWeightMap, type RoleWeightMap} from "./createGraph";

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
  //   "default": 0,
  //   "core:626763367893303303": 2,
  //   "contributor:456763457893303303": 1,
  // }
  // Note that roles have a snowflake identifier.
  // default is used to set weights for members who don't have a specified role
  +roleWeights: RoleWeightMap,
|};

export const parser: Combo.Parser<DiscordConfig> = (() => {
  const C = Combo;
  return C.object({
    guildId: C.string,
    reactionWeights: C.dict(C.number),
    roleWeights: C.dict(C.number),
  });
})();
