// @flow

import {type DiscordConfig, parseConfig} from "./config";

describe("plugins/experimental-discord/config", () => {
  it("can load a basic config", () => {
    const raw = {
      guildId: "453243919774253079",
      reactionWeights: {
        "🥰": 4,
        ":sourcecred:626763367893303303": 16,
      },
    };
    const parsed: DiscordConfig = parseConfig(raw);
    expect(parsed).toEqual(raw);
  });
});
