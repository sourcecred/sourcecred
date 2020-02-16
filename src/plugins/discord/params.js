// @flow

import * as Model from "./models";
import {type EmojiWeightMap} from "./createGraph";

export type {BotToken as DiscordToken} from "./models";

export type ProjectOptions = {|
  +guildId: Model.Snowflake,
  +reactionWeights: EmojiWeightMap,
|};
