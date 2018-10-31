// @flow

import React from "react";
import {shallow} from "enzyme";
import {PluginWeightConfig} from "./PluginWeightConfig";
import {
  FactorioStaticAdapter,
  staticAdapterSet,
} from "../../../plugins/demo/appAdapter";
import {inserterNodeType} from "../../../plugins/demo/declaration";
import {FALLBACK_NAME} from "../../adapters/fallbackAdapter";
import {defaultWeightsForAdapterSet, defaultWeightsForAdapter} from "./weights";
import {WeightConfig} from "./WeightConfig";

require("../../testUtil").configureEnzyme();

describe("app/credExplorer/weights/WeightConfig", () => {
  describe("WeightConfig", () => {
    function example() {
      const onChange = jest.fn();
      const adapters = staticAdapterSet();
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
    it("creates a PluginWeightConfig for every non-fallback adapter", () => {
      const {el, adapters} = example();
      const pwcs = el.find(PluginWeightConfig);
      expect(pwcs).toHaveLength(adapters.adapters().length - 1);
      for (const adapter of adapters.adapters()) {
        if (adapter.declaration().name === FALLBACK_NAME) {
          continue;
        }
        const pwc = pwcs.findWhere(
          (x) =>
            x.props().adapter.declaration().name === adapter.declaration().name
        );
        expect(pwc).toHaveLength(1);
      }
    });
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
        staticAdapterSet()
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
