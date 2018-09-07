// @flow

import React from "react";
import {shallow} from "enzyme";
import {PluginWeightConfig} from "./PluginWeightConfig";
import {
  FactorioStaticAdapter,
  inserterNodeType,
  assemblesEdgeType,
} from "../../adapters/demoAdapters";
import {
  fallbackNodeType,
  fallbackEdgeType,
} from "../../adapters/fallbackAdapter";
import {NodeTypeConfig} from "./NodeTypeConfig";
import {EdgeTypeConfig} from "./EdgeTypeConfig";
import {
  defaultWeightsForAdapter,
  defaultWeightedNodeType,
  defaultWeightedEdgeType,
  type WeightedTypes,
} from "./weights";

require("../../testUtil").configureEnzyme();

describe("app/credExplorer/weights/PluginWeightConfig", () => {
  describe("PluginWeightConfig", () => {
    function example() {
      const onChange = jest.fn();
      const adapter = new FactorioStaticAdapter();
      const types = defaultWeightsForAdapter(adapter);
      const el = shallow(
        <PluginWeightConfig
          weightedTypes={types}
          adapter={adapter}
          onChange={onChange}
        />
      );
      return {el, onChange, adapter};
    }
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
        nodes: new Map(newNodes.map((x) => [x.type.prefix, x])),
        edges: new Map(
          adapter.edgeTypes().map((x) => [x.prefix, defaultWeightedEdgeType(x)])
        ),
      };
      ntc.props().onChange(newWeightedType);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(expected);
    });
    it("EdgeTypeConfig onChange wired properly", () => {
      const {el, adapter, onChange} = example();
      const ntc = el.find(EdgeTypeConfig).at(0);
      const edges = adapter.edgeTypes().map(defaultWeightedEdgeType);
      const newWeightedType = {...edges[0], weight: 707};
      const newEdges = [newWeightedType, ...edges.slice(1)];
      const expected = {
        nodes: new Map(
          adapter.nodeTypes().map((x) => [x.prefix, defaultWeightedNodeType(x)])
        ),
        edges: new Map(newEdges.map((x) => [x.type.prefix, x])),
      };
      ntc.props().onChange(newWeightedType);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(expected);
    });
    describe("errors if", () => {
      function checkError(weightedTypes: WeightedTypes) {
        expect(() =>
          shallow(
            <PluginWeightConfig
              adapter={new FactorioStaticAdapter()}
              weightedTypes={weightedTypes}
              onChange={jest.fn()}
            />
          )
        ).toThrowError("prefixes for adapter");
      }
      it("missing edge prefix in weighted types", () => {
        const badTypes = defaultWeightsForAdapter(new FactorioStaticAdapter());
        badTypes.nodes.delete(inserterNodeType.prefix);
        checkError(badTypes);
      });
      it("missing node prefix in weighted types", () => {
        const badTypes = defaultWeightsForAdapter(new FactorioStaticAdapter());
        badTypes.edges.delete(assemblesEdgeType.prefix);
        checkError(badTypes);
      });
      it("extra node prefix in weighted types", () => {
        const badTypes = defaultWeightsForAdapter(new FactorioStaticAdapter());
        badTypes.nodes.set(fallbackNodeType.prefix, {
          weight: 5,
          type: fallbackNodeType,
        });
        checkError(badTypes);
      });
      it("extra edge prefix in weighted types", () => {
        const badTypes = defaultWeightsForAdapter(new FactorioStaticAdapter());
        badTypes.edges.set(fallbackEdgeType.prefix, {
          forwardWeight: 5,
          backwardWeight: 3,
          type: fallbackEdgeType,
        });
        checkError(badTypes);
      });
    });
  });
});
