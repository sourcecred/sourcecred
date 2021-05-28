// @flow

import * as C from "../../util/combo";
import stringify from "json-stable-stringify";
import {DiskStorage} from "../../core/storage/disk";
import {loadJsonWithDefault} from "../../util/storage";
import {join as pathJoin} from "path";
import {encode} from "../../core/storage/textEncoding";

const v0_8_7_parser = C.object(
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

export const v0_9_0 = async (): Promise<void> => {
  const storage = new DiskStorage(process.cwd());
  const discordConfigPath = pathJoin(
    "config",
    "plugins",
    "sourcecred",
    "discord",
    "config.json"
  );
  const oldConfig = await loadJsonWithDefault(
    storage,
    discordConfigPath,
    v0_8_7_parser,
    () => ""
  );
  if (oldConfig !== "") {
    const newConfig = stringify(
      [
        {
          guildId: oldConfig.guildId,
          reactionWeightConfig: {
            weights: oldConfig.reactionWeights,
            applyAveraging: oldConfig.applyAveragingToReactions || false,
            defaultWeight: oldConfig.defaultReactionWeight || 1,
          },
          roleWeightConfig: oldConfig.roleWeightConfig || {
            defaultWeight: 1,
            weights: {},
          },
          channelWeightConfig: oldConfig.channelWeightConfig || {
            defaultWeight: 1,
            weights: {},
          },
          propsChannels: oldConfig.propsChannels || [],
          includeNsfwChannels: oldConfig.includeNsfwChannels || false,
        },
      ],
      {space: 2}
    );
    storage.set(discordConfigPath, encode(newConfig));
  }
};
