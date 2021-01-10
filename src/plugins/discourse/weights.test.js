// @flow

import {_trustLevelWeight, likeWeight, parseCategoryId} from "./weights";
import {DEFAULT_TRUST_LEVEL_TO_WEIGHT as weights} from "./createGraph";

describe("plugins/discourse/weights", () => {
  describe("likeWeight", () => {
    it("has a weight of 0 for a null or undefined User", () => {
      expect(likeWeight(null)).toEqual(0);
      expect(likeWeight()).toEqual(0);
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

  describe("parseCategoryId", () => {
    it("rejects keys that arent numbers", () => {
      const thunk = () => parseCategoryId("bad");
      expect(thunk).toThrow(`CategoryId should be a number; got bad`);
    });
    it("accepts keys that are numbers", () => {
      expect(parseCategoryId("5")).toEqual("5");
    });
  });
});
