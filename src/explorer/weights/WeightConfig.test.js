// @flow

import React from "react";
import {shallow} from "enzyme";
import {PluginWeightConfig} from "./PluginWeightConfig";
import {
  FactorioStaticAdapter,
  staticExplorerAdapterSet,
} from "../../plugins/demo/explorerAdapter";
import {inserterNodeType} from "../../plugins/demo/declaration";
import {defaultWeightsForAdapterSet, defaultWeightsForAdapter} from "./weights";
import {WeightConfig} from "./WeightConfig";

require("../../webutil/testUtil").configureEnzyme();

describe("explorer/weights/WeightConfig", () => {
  describe("WeightConfig", () => {
    function example() {
      const onChange = jest.fn();
      const adapters = staticExplorerAdapterSet();
      const types = defaultWeightsForAdapterSet(adapters);
      types.nodes.set(inserterNodeType.prefix, {
        weight: 707,
        type: inserterNodeType,
      });
      const el = shallow(
        <WeightConfig
          adapters={adapters}
          weightedTypes={types}
          onChange={onChange}
        />
      );
      return {el, adapters, types, onChange};
    }
    it("sets the PluginWeightConfig weights properly", () => {
      const {el} = example();
      const pwc = el
        .find(PluginWeightConfig)
        .findWhere(
          (x) =>
            x.props().adapter.declaration().name ===
            new FactorioStaticAdapter().declaration().name
        );
      expect(pwc).toHaveLength(1);
      const expectedTypes = defaultWeightsForAdapter(
        new FactorioStaticAdapter()
      );
      expectedTypes.nodes.set(inserterNodeType.prefix, {
        weight: 707,
        type: inserterNodeType,
      });
      expect(pwc.props().weightedTypes).toEqual(expectedTypes);
    });
    it("sets the PluginWeightConfig onChange properly", () => {
      const newFactorioWeights = defaultWeightsForAdapter(
        new FactorioStaticAdapter()
      );
      newFactorioWeights.nodes.set(inserterNodeType.prefix, {
        weight: 955,
        type: inserterNodeType,
      });
      const expectedFullWeights = defaultWeightsForAdapterSet(
        staticExplorerAdapterSet()
      );
      expectedFullWeights.nodes.set(inserterNodeType.prefix, {
        weight: 955,
        type: inserterNodeType,
      });

      const {el, onChange} = example();
      const factorioConfig = el
        .find(PluginWeightConfig)
        .findWhere(
          (x) =>
            x.props().adapter.declaration().name ===
            new FactorioStaticAdapter().declaration().name
        );
      factorioConfig.props().onChange(newFactorioWeights);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(expectedFullWeights);
    });
  });
});
