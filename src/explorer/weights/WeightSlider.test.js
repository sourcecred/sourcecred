// @flow

import React from "react";
import {shallow} from "enzyme";

import {
  WeightSlider,
  formatWeight,
  MIN_SLIDER,
  MAX_SLIDER,
  sliderToWeight,
  weightToSlider,
} from "./WeightSlider";

require("../../webutil/testUtil").configureEnzyme();

describe("explorer/weights/WeightSlider", () => {
  describe("WeightSlider", () => {
    function example() {
      const onChange = jest.fn();
      const element = shallow(
        <WeightSlider weight={3} name="foo" onChange={onChange} />
      );
      return {element, onChange};
    }
    it("sets slider to the log of provided weight", () => {
      const {element} = example();
      expect(element.find("input").props().value).toBe(Math.log2(3));
    });
    it("sets slider value to the minimum value when the provided weight equals zero", () => {
      const element = shallow(
        <WeightSlider weight={0} name="foo" onChange={jest.fn()} />
      );
      expect(element.find("input").props().value).toBe(MIN_SLIDER);
    });
    it("sets weight to zero when the slider value equals the minimum value", () => {
      const {element, onChange} = example();
      const input = element.find("input");
      input.simulate("change", {target: {valueAsNumber: MIN_SLIDER}});
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(0);
    });
    it("prints the provided weight", () => {
      const {element} = example();
      expect(
        element
          .find("span")
          .at(1)
          .text()
      ).toBe(formatWeight(3));
    });
    it("displays the provided name", () => {
      const {element} = example();
      expect(
        element
          .find("span")
          .at(0)
          .text()
      ).toBe("foo");
    });
    it("changes to the slider trigger the onChange with exponentiatied value", () => {
      const {element, onChange} = example();
      const input = element.find("input");
      input.simulate("change", {target: {valueAsNumber: 3}});
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(2 ** 3);
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
    it("weight->slider->weight is identity", () => {
      const legalWeights = [0, 1, 2 ** MAX_SLIDER];
      for (const weight of legalWeights) {
        const position = weightToSlider(weight);
        const weight_ = sliderToWeight(position);
        expect(weight).toEqual(weight_);
      }
    });
    it("weightToSlider errors on weights out of range", () => {
      const illegalValues = [-1, 2 ** MAX_SLIDER + 1];
      for (const illegalValue of illegalValues) {
        expect(() => weightToSlider(illegalValue)).toThrowError(
          "Weight out of range"
        );
      }
    });
    it("sliderToWeight errors on slider position out of range", () => {
      const illegalValues = [MIN_SLIDER - 1, MAX_SLIDER + 1];
      for (const illegalValue of illegalValues) {
        expect(() => sliderToWeight(illegalValue)).toThrowError(
          "Slider position out of range"
        );
      }
    });
    it("sliderToWeight and weightToSlider error on NaN", () => {
      expect(() => sliderToWeight(NaN)).toThrowError("illegal value: NaN");
      expect(() => weightToSlider(NaN)).toThrowError("illegal value: NaN");
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
