// @flow

import React from "react";
import {shallow} from "enzyme";

import {WeightSlider} from "./WeightSlider";
import {EdgeTypeConfig, EdgeWeightSlider} from "./EdgeTypeConfig";
import {assemblesEdgeType} from "../../plugins/demo/declaration";

require("../../webutil/testUtil").configureEnzyme();

describe("ui/weights/EdgeTypeConfig", () => {
  describe("EdgeTypeConfig", () => {
    function example() {
      const onChange = jest.fn();
      const type = assemblesEdgeType;
      const weight = {forwards: 1, backwards: 0.5};
      const element = shallow(
        <EdgeTypeConfig onChange={onChange} type={type} weight={weight} />
      );
      const forwardSlider = element.find(EdgeWeightSlider).at(0);
      const backwardSlider = element.find(EdgeWeightSlider).at(1);
      return {onChange, weight, type, forwardSlider, backwardSlider};
    }
    it("sets up the forward weight slider", () => {
      const {weight, type, forwardSlider} = example();
      expect(forwardSlider.props().name).toBe(type.backwardName);
      expect(forwardSlider.props().weight).toBe(weight.forwards);
    });
    it("sets up the backward weight slider", () => {
      const {weight, type, backwardSlider} = example();
      expect(backwardSlider.props().name).toBe(type.forwardName);
      expect(backwardSlider.props().weight).toBe(weight.backwards);
    });
    it("has a description", () => {
      const {backwardSlider} = example();
      expect(backwardSlider.props().description).toBe(
        assemblesEdgeType.description
      );
    });
    it("forward weight slider onChange works", () => {
      const {weight, forwardSlider, onChange} = example();
      forwardSlider.props().onChange(9);
      const updated = {backwards: weight.backwards, forwards: 9};
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toEqual(updated);
    });
    it("backward weight slider onChange works", () => {
      const {weight, backwardSlider, onChange} = example();
      backwardSlider.props().onChange(9);
      const updated = {forwards: weight.forwards, backwards: 9};
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toEqual(updated);
    });
  });
  describe("EdgeWeightSlider", () => {
    function example() {
      const onChange = jest.fn();
      const element = shallow(
        <EdgeWeightSlider
          weight={3}
          name="foo"
          description="Description for test slider"
          onChange={onChange}
        />
      );
      const weightSlider = element.find(WeightSlider);
      return {element, onChange, weightSlider};
    }
    it("renders the name along with some Greek characters", () => {
      const {weightSlider} = example();
      const name = weightSlider.props().name;
      expect(name).toMatchSnapshot();
    });
    it("passes through the weight unchanged", () => {
      const {weightSlider} = example();
      expect(weightSlider.props().weight).toBe(3);
    });
    it("onChange is wired properly", () => {
      const {weightSlider, onChange} = example();
      expect(weightSlider.props().onChange).toBe(onChange);
    });
  });
});
