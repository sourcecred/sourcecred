// @flow

import {
  _trustLevelWeight,
  _categoryWeight,
  _weightFromTags,
  likeWeight,
  parseCategoryId,
  weightsConfigParser,
  type WeightsConfig,
} from "./weights";

import {DEFAULT_TRUST_LEVEL_TO_WEIGHT as weights} from "./createGraph";

function getConfig(s?: Object): WeightsConfig {
  return weightsConfigParser.parseOrThrow({
    defaultTagWeight: 1,
    defaultCategoryWeight: 1,
    tagWeights: {},
    categoryWeights: {},
    ...s,
  });
}

describe("plugins/discourse/weights", () => {
  describe("likeWeight", () => {
    it("has a weight of 0 for a null or undefined User", () => {
      expect(likeWeight(getConfig(), null)).toEqual(0);
      expect(likeWeight(getConfig())).toEqual(0);
    });
  });

  describe("_trustLevelWeight", () => {
    it("throws an error for an invalid trustLevel", () => {
      const thunk = () => _trustLevelWeight(-1);
      expect(thunk).toThrowError("invalid trust level");
    });
    it("works as expected for a regular user", () => {
      expect(_trustLevelWeight(null)).toEqual(weights[0]);
      [0, 1, 2, 3, 4].forEach((trustLevel) => {
        expect(_trustLevelWeight(trustLevel)).toEqual(
          weights[trustLevel.toString()]
        );
      });
    });
  });

  describe("_categoryWeight", () => {
    it("returns the default weight when the category doesn't have a configured default weight", () => {
      expect(_categoryWeight("1", getConfig())).toBe(1);
    });
    it("returns the default weight when the category doesn't have a set weight", () => {
      expect(_categoryWeight("1", getConfig({defaultCategoryWeight: 3}))).toBe(
        3
      );
    });
    it("returns the configured weight", () => {
      const config = getConfig({
        defaultCategoryWeight: 2,
        categoryWeights: {"1": 5},
      });
      expect(_categoryWeight("1", config)).toBe(5);
    });
    it("can return a weight set to 0", () => {
      const config = getConfig({
        defaultCategoryWeight: 7,
        categoryWeights: {"1": 0},
      });
      expect(_categoryWeight("1", config)).toBe(0);
    });
  });

  describe("_tagWeight", () => {
    it("returns the default weight when the tag doesn't have a configured weight", () => {
      expect(_weightFromTags(["tag"], getConfig())).toBe(1);
    });
    it("returns the default weight when the tag doesn't have a configured weight", () => {
      const config = getConfig({
        defaultTagWeight: 2,
        tagWeights: {"you're": 5},
      });
      expect(_weightFromTags(["you're"], config)).toBe(5);
    });
    it("can return a weight set to 0", () => {
      const config = getConfig({defaultTagWeight: 5, tagWeights: {"it": 0}});
      expect(_weightFromTags(["it"], config)).toBe(0);
    });
    it("returns default tag weight when no tags are assigned", () => {
      expect(_weightFromTags([], getConfig())).toBe(1);
    });
    it("returns the default tag weight when no individual tags are configured", () => {
      const config = getConfig({
        defaultTagWeight: 5,
      });
      expect(_weightFromTags(["you're", "good"], config)).toBe(25);
    });
  });

  describe("parseCategoryId", () => {
    it("rejects keys that arent numbers", () => {
      const thunk = () => parseCategoryId("bad");
      expect(thunk).toThrow(`CategoryId should be a string integer; got bad`);
    });
    it("accepts keys that are numbers", () => {
      expect(parseCategoryId("5")).toEqual("5");
    });
    it("rejects non-integer keys that are numbers", () => {
      const thunk = () => parseCategoryId("5.5");
      expect(thunk).toThrow("CategoryId should be a string integer; got 5.5");
    });
  });
});
