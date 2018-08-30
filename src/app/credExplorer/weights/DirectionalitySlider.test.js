// @flow

import React from "react";
import {shallow} from "enzyme";

import {DirectionalitySlider} from "./DirectionalitySlider";

require("../../testUtil").configureEnzyme();

describe("app/credExplorer/weights/DirectionalitySlider", () => {
  describe("DirectionalitySlider", () => {
    function example() {
      const onChange = jest.fn();
      const element = shallow(
        <DirectionalitySlider
          directionality={0.5}
          name={"foo"}
          onChange={onChange}
        />
      );
      return {element, onChange};
    }
    it("sets slider to the provided weight", () => {
      const {element} = example();
      expect(element.find("input").props().value).toBe(0.5);
    });
    it("slider min is 0", () => {
      const {element} = example();
      expect(element.find("input").props().min).toBe(0);
    });
    it("slider max is 0", () => {
      const {element} = example();
      expect(element.find("input").props().max).toBe(1);
    });
    it("prints the provided weight", () => {
      const {element} = example();
      expect(
        element
          .find("span")
          .at(0)
          .text()
      ).toBe("0.50");
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
      input.simulate("change", {target: {valueAsNumber: 0.99}});
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(0.99);
    });
    it("errors if provided an out-of-bound directionality", () => {
      function withDirectionality(d) {
        return () =>
          shallow(
            <DirectionalitySlider
              directionality={d}
              name={"foo"}
              onChange={jest.fn()}
            />
          );
      }
      expect(withDirectionality(-0.2)).toThrowError(
        "directionality out of bounds"
      );
      expect(withDirectionality(2)).toThrowError(
        "directionality out of bounds"
      );
    });
    it("errors rather than providing an out-of-bound directionality", () => {
      const {element} = example();
      const input = element.find("input");
      expect(() => {
        input.simulate("change", {target: {valueAsNumber: -0.2}});
      }).toThrowError("directionality out of bounds");
      expect(() => {
        input.simulate("change", {target: {valueAsNumber: 2.0}});
      }).toThrowError("directionality out of bounds");
    });
  });
});
