// @flow

import React from "react";
import * as NullUtil from "../../util/null";

import {type EdgeEvaluator} from "../../core/attribution/pagerank";
import {weightsToEdgeEvaluator} from "./weights/weightsToEdgeEvaluator";
import type {StaticPluginAdapter} from "../adapters/pluginAdapter";
import type {StaticAdapterSet} from "../adapters/adapterSet";
import {
  type WeightedTypes,
  defaultWeightsForAdapter,
  combineWeights,
} from "./weights/weights";
import {PluginWeightConfig} from "./weights/PluginWeightConfig";
import {FALLBACK_NAME} from "../adapters/fallbackAdapter";

type Props = {|
  +adapters: StaticAdapterSet,
  +onChange: (EdgeEvaluator) => void,
|};

type State = {
  pluginNameToWeights: Map<string, WeightedTypes>,
  expanded: boolean,
};

export class WeightConfig extends React.Component<Props, State> {
  constructor(props: Props): void {
    super(props);
    this.state = {
      pluginNameToWeights: new Map(),
      expanded: false,
    };
  }

  componentDidMount() {
    this.fire();
  }

  render() {
    const {expanded} = this.state;
    return (
      <React.Fragment>
        <button
          onClick={() => {
            this.setState(({expanded}) => ({expanded: !expanded}));
          }}
        >
          {expanded ? "Hide weight configuration" : "Show weight configuration"}
        </button>
        {expanded && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            {this.pluginWeightConfigs()}
          </div>
        )}
      </React.Fragment>
    );
  }

  pluginWeightConfigs() {
    return this.props.adapters
      .adapters()
      .filter((x) => x.name() !== FALLBACK_NAME)
      .map((adapter) => {
        const onChange = (weightedTypes) => {
          this.state.pluginNameToWeights.set(adapter.name(), weightedTypes);
          this.fire();
        };
        return (
          <PluginWeightConfig
            key={adapter.name()}
            adapter={adapter}
            onChange={onChange}
          />
        );
      });
  }

  fire() {
    const weights = combineWeights(
      this.props.adapters
        .adapters()
        .map((adapter: StaticPluginAdapter) =>
          NullUtil.orElse(
            this.state.pluginNameToWeights.get(adapter.name()),
            defaultWeightsForAdapter(adapter)
          )
        )
    );
    const edgeEvaluator = weightsToEdgeEvaluator(weights);
    this.props.onChange(edgeEvaluator);
  }
}
