/*
 * @flow
 * @jest-environment jsdom
 */

import React from "react";
import {mount} from "enzyme";

import {
  WeightSlider,
  formatWeight,
  MIN_SLIDER,
  MAX_SLIDER,
  sliderToWeight,
  weightToSlider,
  type Weight,
} from "./WeightSlider";

require("../../webutil/testUtil").configureEnzyme();

describe("ui/weights/WeightSlider", () => {
  describe("WeightSlider", () => {
    function example(weight: Weight) {
      const onChange = jest.fn();
      const element = mount(
        <WeightSlider
          weight={weight}
          name="foo"
          onChange={onChange}
          description="A test description"
        />
      );
      return {element};
    }
    // These are all valid weights, but not all of them correspond to a valid
    // slider position.
    const exampleWeights = [0, 2 ** -10, 0.25, 0.33, 1, 20];
    it("sets the slider as corresponds to the current weight", () => {
      for (const w of exampleWeights) {
        const expectedSlider = weightToSlider(w);
        const {element} = example(w);
        const inputVal = element.find("input").props().value;
        expect(parseInt(inputVal, 10)).toBe(expectedSlider);
      }
    });
    it("prints the provided weight", () => {
      for (const w of exampleWeights) {
        const {element} = example(w);
        expect(element.find("div").at(3).text()).toBe(formatWeight(w));
      }
    });
    it("displays the provided name", () => {
      const {element} = example(0);
      expect(element.find("div").at(1).text()).toBe("foo");
    });
    it("has a description tooltip", () => {
      const {element} = example(0);
      expect(element.find("div").at(0).prop("title")).toBe(
        "A test description"
      );
    });
  });

  describe("weight<-> slider conversions", () => {
    it("slider->weight->slider is identity", () => {
      const legalSliderPositions = [MIN_SLIDER, 0, MAX_SLIDER];
      for (const sliderPosition of legalSliderPositions) {
        const weight = sliderToWeight(sliderPosition);
        const position_ = weightToSlider(weight);
        expect(sliderPosition).toEqual(position_);
      }
    });
    it("weightToSlider truncates when out of range", () => {
      const tinyWeight = sliderToWeight(MIN_SLIDER) / 2;
      expect(weightToSlider(tinyWeight)).toEqual(MIN_SLIDER);

      const giantWeight = sliderToWeight(MAX_SLIDER) * 2;
      expect(weightToSlider(giantWeight)).toEqual(MAX_SLIDER);
    });
    it("weightToSlider errors on invalid weights", () => {
      const invalid = [NaN, Infinity, -Infinity, -1];
      for (const v of invalid) {
        expect(() => weightToSlider(v)).toThrowError("illegal weight");
      }
    });
    it("weightToSlider rounds to closest corresponding slider value", () => {
      const nonIntegerSliders = [-0.3, 0.3, 0.9];
      for (const nonIntegerSlider of nonIntegerSliders) {
        const w = 2 ** nonIntegerSlider;
        expect(weightToSlider(w)).toEqual(Math.round(nonIntegerSlider));
      }
    });
    it("sliderToWeight errors on slider position out of range", () => {
      const illegalValues = [
        -Infinity,
        MIN_SLIDER - 1,
        MAX_SLIDER + 1,
        Infinity,
      ];
      for (const illegalValue of illegalValues) {
        expect(() => sliderToWeight(illegalValue)).toThrowError(
          "Slider position out of range"
        );
      }
    });
    it("sliderToWeight errors on non-integer values", () => {
      const nonIntegers = [-0.3, 0.3, 0.9];
      for (const nonInteger of nonIntegers) {
        expect(() => sliderToWeight(nonInteger)).toThrowError(
          "slider position not integer"
        );
      }
    });
    it("sliderToWeight errors on NaN", () => {
      expect(() => sliderToWeight(NaN)).toThrowError("illegal value: NaN");
    });
  });
  describe("formatWeight", () => {
    it("shows numbers greater than 1 as a integer-rounded multiplier", () => {
      expect(formatWeight(5.3)).toBe("5×");
    });
    it("shows numbers less than 1 (but not 0) as integer-rounded fractions", () => {
      expect(formatWeight(0.249)).toBe("1/4×");
    });
    it("shows numbers equal to 0 as 0x", () => {
      expect(formatWeight(0)).toBe("0×");
    });
    it("throws on bad values", () => {
      const bads = [NaN, Infinity, -Infinity, -3];
      for (const bad of bads) {
        expect(() => formatWeight(bad)).toThrowError("Invalid weight");
      }
    });
  });
});
