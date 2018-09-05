// @flow

import React from "react";

import {type EdgeEvaluator} from "../../core/attribution/pagerank";
import {weightsToEdgeEvaluator} from "./weights/weightsToEdgeEvaluator";
import type {StaticAdapterSet} from "../adapters/adapterSet";
import {
  type WeightedTypes,
  PluginWeightConfig,
} from "./weights/PluginWeightConfig";
import {
  type WeightedNodeType,
  defaultWeightedNodeType,
} from "./weights/NodeTypeConfig";
import {
  type WeightedEdgeType,
  defaultWeightedEdgeType,
} from "./weights/EdgeTypeConfig";
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
    let nodeWeights: WeightedNodeType[] = [];
    let edgeWeights: WeightedEdgeType[] = [];
    for (const adapter of this.props.adapters.adapters()) {
      const weights = this.state.pluginNameToWeights.get(adapter.name());
      const newNodeWeights =
        weights == null
          ? adapter.nodeTypes().map(defaultWeightedNodeType)
          : weights.nodes;
      const newEdgeWeights =
        weights == null
          ? adapter.edgeTypes().map(defaultWeightedEdgeType)
          : weights.edges;
      nodeWeights = nodeWeights.concat(newNodeWeights);
      edgeWeights = edgeWeights.concat(newEdgeWeights);
    }

    const weights = {nodes: nodeWeights, edges: edgeWeights};
    const edgeEvaluator = weightsToEdgeEvaluator(weights);
    this.props.onChange(edgeEvaluator);
  }
}
