// @flow

import {type DiscordConfigs, parser} from "./config";

describe("plugins/discord/config", () => {
  it("can load a basic config", () => {
    const raw = [
      {
        guildId: "453243919774253079",
        reactionWeightConfig: {
          weights: {
            "🥰": 4,
            "sourcecred:626763367893303303": 16,
          },
          applyAveraging: true,
          defaultWeight: 2,
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
        simplifyGraph: true,
        beginningDate: "1/1/2021",
      },
    ];
    const expected = [
      {
        guildId: "453243919774253079",
        propsChannels: [],
        weights: {
          emojiWeights: {
            weights: {
              "🥰": 4,
              "sourcecred:626763367893303303": 16,
            },
            applyAveraging: true,
            defaultWeight: 2,
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
        simplifyGraph: true,
        beginningTimestampMs: 1609452000000,
      },
    ];
    const parsed: DiscordConfigs = parser.parseOrThrow(raw);
    expect(parsed).toEqual(expected);
  });
  it("fills in optional properties", () => {
    const raw = [
      {
        guildId: "453243919774253079",
        reactionWeightConfig: {
          weights: {
            "🥰": 4,
            "sourcecred:626763367893303303": 16,
          },
          applyAveraging: true,
          defaultWeight: 2,
        },
      },
    ];
    const parsed: DiscordConfigs = parser.parseOrThrow(raw);
    expect(parsed[0].weights.roleWeights).toEqual({
      weights: {},
      defaultWeight: 1,
    });
    expect(parsed[0].weights.channelWeights).toEqual({
      weights: {},
      defaultWeight: 1,
    });
    expect(parsed[0].includeNsfwChannels).toEqual(false);
    expect(parsed[0].simplifyGraph).toEqual(false);
    expect(parsed[0].beginningTimestampMs).toEqual(-Infinity);
  });
  it("can work with delimiters", () => {
    const raw = [
      {
        guildId: "453243919774253079//sourcecred",
        reactionWeightConfig: {
          weights: {
            "🥰": 4,
            "sourcecred:626763367893303303": 16,
          },
          applyAveraging: true,
          defaultWeight: 2,
        },
        roleWeightConfig: {
          defaultWeight: 0,
          weights: {
            "759191073943191613//first-role": 0.5,
            "762085832181153872//second-role": 1,
            "698296035889381403": 1,
          },
        },
        channelWeightConfig: {
          defaultWeight: 0,
          weights: {
            "759191073943191613//channel name": 0.25,
          },
        },
        includeNsfwChannels: true,
      },
    ];
    const expected = [
      {
        guildId: "453243919774253079",
        propsChannels: [],
        weights: {
          emojiWeights: {
            weights: {
              "🥰": 4,
              "sourcecred:626763367893303303": 16,
            },
            applyAveraging: true,
            defaultWeight: 2,
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
        simplifyGraph: false,
        beginningTimestampMs: -Infinity,
      },
    ];
    const parsed: DiscordConfigs = parser.parseOrThrow(raw);
    expect(parsed).toEqual(expected);
  });
});
