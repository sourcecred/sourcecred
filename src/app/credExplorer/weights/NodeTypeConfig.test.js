// @flow

import React from "react";
import {shallow} from "enzyme";

import {WeightSlider} from "./WeightSlider";
import {defaultWeightedNodeType, NodeTypeConfig} from "./NodeTypeConfig";
import {inserterNodeType} from "../../adapters/demoAdapters";

require("../../testUtil").configureEnzyme();

describe("app/credExplorer/weights/NodeTypeConfig", () => {
  describe("defaultWeightedNodeType", () => {
    it("sets default weight as specified in type", () => {
      const wnt = defaultWeightedNodeType(inserterNodeType);
      expect(wnt.weight).toEqual(wnt.type.defaultWeight);
    });
  });
  describe("NodeTypeConfig", () => {
    function example() {
      const onChange = jest.fn();
      const wnt = {
        type: inserterNodeType,
        weight: 0.125,
      };
      const element = shallow(
        <NodeTypeConfig onChange={onChange} weightedType={wnt} />
      );
      const slider = element.find(WeightSlider);
      return {onChange, wnt, slider};
    }
    it("sets up the weight slider", () => {
      const {wnt, slider} = example();
      expect(slider.props().name).toBe(wnt.type.name);
      expect(slider.props().weight).toBe(wnt.weight);
    });
    it("weight slider onChange works", () => {
      const {wnt, slider, onChange} = example();
      slider.props().onChange(9);
      const updated = {...wnt, weight: 9};
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toEqual(updated);
    });
  });
});
