// @flow

import {type DiscordConfig, parser} from "./config";

describe("plugins/experimental-discord/config", () => {
  it("can load a basic config", () => {
    const raw = {
      guildId: "453243919774253079",
      useAsymptoticReactionWeights: true,
      reactionWeights: {
        "🥰": 4,
        "sourcecred:626763367893303303": 16,
      },
      roleWeightConfig: {
        defaultWeight: 0,
        roleWeights: {
          "759191073943191613": 0.5,
          "762085832181153872": 1,
          "698296035889381403": 1,
        },
      },
      channelWeightConfig: {
        defaultWeight: 0,
        channelWeights: {
          "759191073943191613": 0.25,
        },
      },
    };
    const parsed: DiscordConfig = parser.parseOrThrow(raw);
    expect(parsed).toEqual(raw);
  });
});
