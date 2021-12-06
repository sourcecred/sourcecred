// @flow

import {getOperator, getWeight, hasExplicitWeight} from "./config";
import {buildConfig} from "./testUtils.test";

describe("core/credEquate/config", () => {
  const config = buildConfig();

  const weightOperand = {
    key: "emoji",
    subkey: "2",
  };
  const weightOperandWithNonExistentSubkey = {
    key: "emoji",
    subkey: "non-existent-subkey",
  };
  const nonExistentKeyWeightOperand = {
    key: "non-existent-key",
    subkey: "non-existent-subkey",
  };

  describe("hasExplicitWeight", () => {
    it("returns true if WeightConfig doesn't have the subkey in its subkeys arrays", function () {
      expect(hasExplicitWeight(weightOperand, config.weights)).toEqual(true);
    });

    it("returns false if WeightConfig doesn't have the subkey in its subkeys arrays", () => {
      expect(
        hasExplicitWeight(weightOperandWithNonExistentSubkey, config.weights)
      ).toEqual(false);
    });

    it("throws if the key has not been set in the configuration", () => {
      expect(() =>
        hasExplicitWeight(nonExistentKeyWeightOperand, config.weights)
      ).toThrow();
    });
  });

  describe("getWeight()", () => {
    it("returns the subkey's weight when found", () => {
      expect(getWeight(weightOperand, config.weights)).toEqual(3);
    });

    it("returns default weight when subkey is not found", () => {
      expect(
        getWeight(weightOperandWithNonExistentSubkey, config.weights)
      ).toEqual(1);
    });

    it("throws if the key has not been set in the configuration", () => {
      expect(() =>
        getWeight(nonExistentKeyWeightOperand, config.weights)
      ).toThrow();
    });
  });

  describe("getOperator", () => {
    it("throws if the raw key is not prefixed", () => {
      expect(() => getOperator("emoji", config)).toThrow();
    });

    it("returns operator", () => {
      expect(getOperator("key:emoji", config)).toBe("ADD");
    });

    it("throws if the operator has not been set in the configuration", () => {
      expect(() => getOperator("key:unknown", config)).toThrow();
    });

    it("throws if the operator is invalid configuration", () => {
      expect(() => getOperator("key:roles", config)).toThrow();
    });
  });
});
