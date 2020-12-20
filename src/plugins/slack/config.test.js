//@flow

import {type SlackConfig, parser, _upgrade} from "./config";

describe("plugins/slack/config", () => {
  it ("can load a basic config", () => {
    const raw = {
      token: "token123",
      reactionWeightConfig: {
        defaultWeight: 0,
        weights: {
          "poodle": 4,
          "seedling": 8
        }
      },
      channelWeightConfig: {
        defaultWeight: 0,
        weights: {
          "C017LH1M3JA": 3,
          "gratitude": 5
        }
      }
    };
    const parsed: SlackConfig = parser.parseOrThrow(raw);
    expect(parsed).toEqual(_upgrade(raw));
  });
  it ("fills in optional parameters", () => {
    const raw = {
      token: "token123",
      reactionWeightConfig: {
        defaultWeight: 0,
        weights: {
          "poodle": 4,
          "seedling": 8
        }
      }
    };
    const parsed: SlackConfig = parser.parseOrThrow(raw);
    expect(parsed.weights.channelWeights).toEqual({
      defaultWeight:1,
      weights:{}
    });
  });
})
