// @flow

import React from "react";
import * as NullUtil from "../../util/null";
import * as MapUtil from "../../util/map";

import type {StaticAdapterSet} from "../adapters/adapterSet";
import type {WeightedTypes} from "./weights/weights";
import {PluginWeightConfig} from "./weights/PluginWeightConfig";
import {FALLBACK_NAME} from "../adapters/fallbackAdapter";

type Props = {|
  +adapters: StaticAdapterSet,
  +weightedTypes: WeightedTypes,
  +onChange: (WeightedTypes) => void,
|};

type State = {|
  expanded: boolean,
|};

export class WeightConfig extends React.Component<Props, State> {
  constructor(props: Props): void {
    super(props);
    this.state = {
      expanded: false,
    };
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
            {this._renderPluginWeightConfigs()}
          </div>
        )}
      </React.Fragment>
    );
  }

  _renderPluginWeightConfigs() {
    return this.props.adapters
      .adapters()
      .filter((x) => x.name() !== FALLBACK_NAME)
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
        for (const {prefix} of adapter.nodeTypes()) {
          pluginScopedWeightedTypes.nodes.set(
            prefix,
            NullUtil.get(this.props.weightedTypes.nodes.get(prefix))
          );
        }
        for (const {prefix} of adapter.edgeTypes()) {
          pluginScopedWeightedTypes.edges.set(
            prefix,
            NullUtil.get(this.props.weightedTypes.edges.get(prefix))
          );
        }
        return (
          <PluginWeightConfig
            key={adapter.name()}
            adapter={adapter}
            onChange={onChange}
            weightedTypes={pluginScopedWeightedTypes}
          />
        );
      });
  }
}
