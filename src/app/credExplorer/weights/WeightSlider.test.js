// @flow

import React from "react";
import {shallow} from "enzyme";

import {WeightSlider, formatWeight} from "./WeightSlider";

require("../../testUtil").configureEnzyme();

describe("app/credExplorer/weights/WeightSlider", () => {
  describe("WeightSlider", () => {
    function example() {
      const onChange = jest.fn();
      const element = shallow(
        <WeightSlider weight={3} name={"foo"} onChange={onChange} />
      );
      return {element, onChange};
    }
    it("sets slider to the provided weight", () => {
      const {element} = example();
      expect(element.find("input").props().value).toBe(3);
    });
    it("prints the provided weight", () => {
      const {element} = example();
      expect(
        element
          .find("span")
          .at(0)
          .text()
      ).toBe(formatWeight(3));
    });
    it("displays the provided name", () => {
      const {element} = example();
      expect(
        element
          .find("span")
          .at(1)
          .text()
      ).toBe("foo");
    });
    it("changes to the slider trigger the onChange", () => {
      const {element, onChange} = example();
      const input = element.find("input");
      input.simulate("change", {target: {valueAsNumber: 7}});
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(7);
    });
  });

  describe("formatWeight", () => {
    it("rounds to one decimal", () => {
      expect(formatWeight(0.123)).toBe("+0.1");
    });
    it("adds a + to 0", () => {
      expect(formatWeight(0)).toBe("+0.0");
    });
    it("adds a minus symbol to negative numbers", () => {
      expect(formatWeight(-3)).toBe("\u22123.0");
    });
  });
});
