// @flow

import React from "react";
import * as NullUtil from "../../util/null";
import * as MapUtil from "../../util/map";

import type {StaticAdapterSet} from "../adapters/adapterSet";
import type {WeightedTypes} from "../../analysis/weights";
import {PluginWeightConfig} from "./PluginWeightConfig";
import {FALLBACK_NAME} from "../../analysis/fallbackDeclaration";

type Props = {|
  +adapters: StaticAdapterSet,
  +weightedTypes: WeightedTypes,
  +onChange: (WeightedTypes) => void,
|};

export class WeightConfig extends React.Component<Props> {
  constructor(props: Props): void {
    super(props);
  }

  render() {
    return (
      <React.Fragment>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          {this._renderPluginWeightConfigs()}
        </div>
      </React.Fragment>
    );
  }

  _renderPluginWeightConfigs() {
    return this.props.adapters
      .adapters()
      .filter((x) => x.declaration().name !== FALLBACK_NAME)
      .map((adapter) => {
        const onChange = (weightedTypes) => {
          const newWeightedTypes = {
            nodes: MapUtil.copy(this.props.weightedTypes.nodes),
            edges: MapUtil.copy(this.props.weightedTypes.edges),
          };
          for (const [key, val] of weightedTypes.nodes.entries()) {
            newWeightedTypes.nodes.set(key, val);
          }
          for (const [key, val] of weightedTypes.edges.entries()) {
            newWeightedTypes.edges.set(key, val);
          }
          this.props.onChange(newWeightedTypes);
        };
        const pluginScopedWeightedTypes = {
          nodes: new Map(),
          edges: new Map(),
        };
        for (const {prefix} of adapter.declaration().nodeTypes) {
          pluginScopedWeightedTypes.nodes.set(
            prefix,
            NullUtil.get(this.props.weightedTypes.nodes.get(prefix))
          );
        }
        for (const {prefix} of adapter.declaration().edgeTypes) {
          pluginScopedWeightedTypes.edges.set(
            prefix,
            NullUtil.get(this.props.weightedTypes.edges.get(prefix))
          );
        }
        return (
          <PluginWeightConfig
            key={adapter.declaration().name}
            adapter={adapter}
            onChange={onChange}
            weightedTypes={pluginScopedWeightedTypes}
          />
        );
      });
  }
}
