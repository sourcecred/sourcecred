// @flow

import React from "react";
import {shallow} from "enzyme";

import {WeightSlider} from "./WeightSlider";
import {NodeTypeConfig} from "./NodeTypeConfig";
import {inserterNodeType} from "../../plugins/demo/declaration";

require("../../webutil/testUtil").configureEnzyme();

describe("ui/weights/NodeTypeConfig", () => {
  describe("NodeTypeConfig", () => {
    function example() {
      const onChange = jest.fn();
      const type = inserterNodeType;
      const weight = 0.125;
      const element = shallow(
        <NodeTypeConfig onChange={onChange} weight={weight} type={type} />
      );
      const slider = element.find(WeightSlider);
      return {onChange, weight, type, slider};
    }
    it("sets up the weight slider", () => {
      const {weight, type, slider} = example();
      expect(slider.props().name).toBe(type.name);
      expect(slider.props().weight).toBe(weight);
    });
    it("has a description", () => {
      const {type, slider} = example();
      expect(slider.props().description).toBe(type.description);
    });
    it("weight slider onChange works", () => {
      const {slider, onChange} = example();
      slider.props().onChange(9);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toEqual(9);
    });
  });
});
