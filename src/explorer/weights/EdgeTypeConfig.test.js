// @flow

import React from "react";
import {shallow} from "enzyme";

import {WeightSlider} from "./WeightSlider";
import {EdgeTypeConfig, EdgeWeightSlider} from "./EdgeTypeConfig";
import {assemblesEdgeType} from "../../plugins/demo/declaration";

require("../../webutil/testUtil").configureEnzyme();

describe("explorer/weights/EdgeTypeConfig", () => {
  describe("EdgeTypeConfig", () => {
    function example() {
      const onChange = jest.fn();
      const wet = {
        type: assemblesEdgeType,
        forwardWeight: 1,
        backwardWeight: 0.5,
      };
      const element = shallow(
        <EdgeTypeConfig onChange={onChange} weightedType={wet} />
      );
      const forwardSlider = element.find(EdgeWeightSlider).at(0);
      const backwardSlider = element.find(EdgeWeightSlider).at(1);
      return {onChange, wet, forwardSlider, backwardSlider};
    }
    it("sets up the forward weight slider", () => {
      const {wet, forwardSlider} = example();
      expect(forwardSlider.props().name).toBe(assemblesEdgeType.backwardName);
      expect(forwardSlider.props().weight).toBe(wet.forwardWeight);
    });
    it("sets up the backward weight slider", () => {
      const {wet, backwardSlider} = example();
      expect(backwardSlider.props().name).toBe(assemblesEdgeType.forwardName);
      expect(backwardSlider.props().weight).toBe(wet.backwardWeight);
    });
    it("forward weight slider onChange works", () => {
      const {wet, forwardSlider, onChange} = example();
      forwardSlider.props().onChange(9);
      const updated = {...wet, forwardWeight: 9};
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toEqual(updated);
    });
    it("backward weight slider onChange works", () => {
      const {wet, backwardSlider, onChange} = example();
      backwardSlider.props().onChange(9);
      const updated = {...wet, backwardWeight: 9};
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toEqual(updated);
    });
  });
  describe("EdgeWeightSlider", () => {
    function example() {
      const onChange = jest.fn();
      const element = shallow(
        <EdgeWeightSlider weight={3} name="foo" onChange={onChange} />
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
