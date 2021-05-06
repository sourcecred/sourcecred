// @flow

import {type DiscordConfig, parser} from "./config";

describe("plugins/discord/config", () => {
  it("can load a basic config", () => {
    const raw = {
      guildId: "453243919774253079",
      reactionWeights: {
        "🥰": 4,
        "sourcecred:626763367893303303": 16,
      },
      roleWeightConfig: {
        defaultWeight: 0,
        weights: {
          "759191073943191613": 0.5,
          "762085832181153872": 1,
          "698296035889381403": 1,
        },
      },
      channelWeightConfig: {
        defaultWeight: 0,
        weights: {
          "759191073943191613": 0.25,
        },
      },
      includeNsfwChannels: true,
      defaultReactionWeight: 0,
      applyAveragingToReactions: true,
    };
    const expected = {
      guildId: "453243919774253079",
      propsChannels: [],
      weights: {
        emojiWeights: {
          applyAveraging: true,
          defaultWeight: 0,
          weights: {
            "🥰": 4,
            "sourcecred:626763367893303303": 16,
          },
        },
        channelWeights: {
          defaultWeight: 0,
          weights: {
            "759191073943191613": 0.25,
          },
        },
        roleWeights: {
          defaultWeight: 0,
          weights: {
            "759191073943191613": 0.5,
            "762085832181153872": 1,
            "698296035889381403": 1,
          },
        },
      },
      includeNsfwChannels: true,
    };
    const parsed: DiscordConfig = parser.parseOrThrow(raw);
    expect(parsed).toEqual(expected);
  });
  it("fills in optional properties", () => {
    const raw = {
      guildId: "453243919774253079",
      reactionWeights: {
        "🥰": 4,
        "sourcecred:626763367893303303": 16,
      },
    };
    const parsed: DiscordConfig = parser.parseOrThrow(raw);
    expect(parsed.weights.roleWeights).toEqual({weights: {}, defaultWeight: 1});
    expect(parsed.weights.channelWeights).toEqual({
      weights: {},
      defaultWeight: 1,
    });
    expect(parsed.includeNsfwChannels).toEqual(false);
    expect(parsed.weights.emojiWeights.applyAveraging).toEqual(false);
    expect(parsed.weights.emojiWeights.defaultWeight).toEqual(1);
  });
});
