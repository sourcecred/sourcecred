// @flow

import {upgrade} from "./config";

describe("plugins/discourse/config", () => {
  it("parses weights successfully when none are present", () => {
    expect(upgrade({serverUrl: "https://test.test"})).toEqual({
      serverUrl: "https://test.test",
      "weights": {
        "categoryWeights": new Map(),
        "defaultCategoryWeight": 1,
        "defaultTagWeight": 1,
        "tagWeights": new Map(),
      },
    });
  });
  it("accepts a partially filled-in serializedWeightsConfig", () => {
    expect(
      upgrade({
        serverUrl: "https://test.test",
        weights: {defaultCategoryWeight: 5},
      })
    ).toEqual({
      serverUrl: "https://test.test",
      "weights": {
        "categoryWeights": new Map(),
        "defaultCategoryWeight": 5,
        "defaultTagWeight": 1,
        "tagWeights": new Map(),
      },
    });
  });
});
