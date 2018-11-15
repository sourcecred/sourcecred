// @flow

import React from "react";
import {shallow} from "enzyme";

import {WeightSlider, formatWeight, WEIGHT_SLIDER_MIN} from "./WeightSlider";

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
      expect(element.find("input").props().value).toBe(WEIGHT_SLIDER_MIN);
    });
    it("sets weight to zero when the slider value equals the minimum value", () => {
      const {element, onChange} = example();
      const input = element.find("input");
      input.simulate("change", {target: {valueAsNumber: WEIGHT_SLIDER_MIN}});
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
      input.simulate("change", {target: {valueAsNumber: 7}});
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(2 ** 7);
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
