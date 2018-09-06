// @flow

import React from "react";
import * as MapUtil from "../../../util/map";
import {NodeTypeConfig} from "./NodeTypeConfig";
import {EdgeTypeConfig} from "./EdgeTypeConfig";
import {StaticPluginAdapter} from "../../adapters/pluginAdapter";
import {styledVariable} from "./EdgeTypeConfig";
import {
  type WeightedTypes,
  type WeightedEdgeType,
  type WeightedNodeType,
  defaultWeightsForAdapter,
} from "./weights";

export type Props = {|
  +adapter: StaticPluginAdapter,
  +onChange: (WeightedTypes) => void,
|};
export type State = {|
  weights: WeightedTypes,
|};

export class PluginWeightConfig extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const weights = defaultWeightsForAdapter(this.props.adapter);
    this.state = {weights};
  }

  fire() {
    this.props.onChange(this.state.weights);
  }

  componentDidMount() {
    this.fire();
  }

  _renderNodeWeightControls() {
    return Array.from(this.state.weights.nodes.values()).map(
      (wnt: WeightedNodeType) => {
        const onChange = (newType: WeightedNodeType) => {
          this.setState(
            (state) => {
              const newNodes = MapUtil.copy(state.weights.nodes);
              newNodes.set(newType.type.prefix, newType);
              const weights = {...state.weights, nodes: newNodes};
              return {weights};
            },
            () => this.fire()
          );
        };
        return (
          <NodeTypeConfig
            key={wnt.type.prefix}
            weightedType={wnt}
            onChange={onChange}
          />
        );
      }
    );
  }

  _renderEdgeWeightControls() {
    return Array.from(this.state.weights.edges.values()).map(
      (wnt: WeightedEdgeType) => {
        const onChange = (newType: WeightedEdgeType) => {
          this.setState(
            (state) => {
              const newEdges = MapUtil.copy(state.weights.edges);
              newEdges.set(newType.type.prefix, newType);
              const weights = {...state.weights, edges: newEdges};
              return {weights};
            },
            () => this.fire()
          );
        };
        return (
          <EdgeTypeConfig
            key={wnt.type.prefix}
            weightedType={wnt}
            onChange={onChange}
          />
        );
      }
    );
  }

  render() {
    return (
      <div>
        <h3>{this.props.adapter.name()}</h3>
        <h4 style={{marginBottom: "0.3em"}}>Node weights</h4>
        {this._renderNodeWeightControls()}
        <h4 style={{marginBottom: "0.3em"}}>Edge weights</h4>
        <p style={{marginBottom: "0.6em", marginTop: "0.6em"}}>
          Flow cred from {styledVariable("β")} to {styledVariable("α")} when:
        </p>
        {this._renderEdgeWeightControls()}
      </div>
    );
  }
}
