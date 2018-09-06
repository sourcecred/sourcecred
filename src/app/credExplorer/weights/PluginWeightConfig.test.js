// @flow

import React from "react";
import {shallow} from "enzyme";
import {PluginWeightConfig} from "./PluginWeightConfig";
import {FactorioStaticAdapter} from "../../adapters/demoAdapters";
import {NodeTypeConfig} from "./NodeTypeConfig";
import {EdgeTypeConfig} from "./EdgeTypeConfig";
import {
  defaultWeightsForAdapter,
  defaultWeightedNodeType,
  defaultWeightedEdgeType,
} from "./weights";

require("../../testUtil").configureEnzyme();

describe("src/app/credExplorer/weights/PluginWeightConfig", () => {
  describe("PluginWeightConfig", () => {
    function example() {
      const onChange = jest.fn();
      const adapter = new FactorioStaticAdapter();
      const el = shallow(
        <PluginWeightConfig adapter={adapter} onChange={onChange} />
      );
      return {el, onChange, adapter};
    }
    it("fires plugin's default weights on mount", () => {
      const {onChange, adapter} = example();
      const expected = defaultWeightsForAdapter(adapter);
      expect(onChange).toHaveBeenCalledWith(expected);
    });
    it("renders a NodeTypeConfig for each node type", () => {
      const {el, adapter} = example();
      const ntc = el.find(NodeTypeConfig);
      const nodeTypes = adapter.nodeTypes();
      for (let i = 0; i < nodeTypes.length; i++) {
        const weightedType = defaultWeightedNodeType(nodeTypes[i]);
        expect(ntc.at(i).props().weightedType).toEqual(weightedType);
      }
    });
    it("renders a EdgeTypeConfig for each edge type", () => {
      const {el, adapter} = example();
      const ntc = el.find(EdgeTypeConfig);
      const edgeTypes = adapter.edgeTypes();
      for (let i = 0; i < edgeTypes.length; i++) {
        const weightedType = defaultWeightedEdgeType(edgeTypes[i]);
        expect(ntc.at(i).props().weightedType).toEqual(weightedType);
      }
    });
    it("NodeTypeConfig onChange wired properly", () => {
      const {el, adapter, onChange} = example();
      const ntc = el.find(NodeTypeConfig).at(0);

      const nodes = adapter.nodeTypes().map(defaultWeightedNodeType);
      const newWeightedType = {...nodes[0], weight: 707};
      const newNodes = [newWeightedType, ...nodes.slice(1)];
      const expected = {
        nodes: newNodes,
        edges: adapter.edgeTypes().map(defaultWeightedEdgeType),
      };
      ntc.props().onChange(newWeightedType);
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange.mock.calls[1][0]).toEqual(expected);
    });
    it("EdgeTypeConfig onChange wired properly", () => {
      const {el, adapter, onChange} = example();
      const ntc = el.find(EdgeTypeConfig).at(0);
      const edges = adapter.edgeTypes().map(defaultWeightedEdgeType);
      const newWeightedType = {...edges[0], weight: 707};
      const newEdges = [newWeightedType, ...edges.slice(1)];
      const expected = {
        nodes: adapter.nodeTypes().map(defaultWeightedNodeType),
        edges: newEdges,
      };
      ntc.props().onChange(newWeightedType);
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange.mock.calls[1][0]).toEqual(expected);
    });
  });
});
