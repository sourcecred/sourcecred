// @flow

import React from "react";
import deepEqual from "lodash.isequal";
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
    return this.state.weights.nodes.map((wnt: WeightedNodeType) => {
      const onChange = (newType: WeightedNodeType) => {
        const index = this.state.weights.nodes.findIndex((x) =>
          deepEqual(x.type, wnt.type)
        );
        const newNodes = this.state.weights.nodes.slice();
        newNodes[index] = newType;
        const weights = {nodes: newNodes, edges: this.state.weights.edges};
        this.setState({weights}, () => this.fire());
      };
      return (
        <NodeTypeConfig
          key={wnt.type.prefix}
          weightedType={wnt}
          onChange={onChange}
        />
      );
    });
  }

  _renderEdgeWeightControls() {
    return this.state.weights.edges.map((wnt: WeightedEdgeType) => {
      const onChange = (newType: WeightedEdgeType) => {
        const index = this.state.weights.edges.findIndex((x) =>
          deepEqual(x.type, wnt.type)
        );
        const newEdges = this.state.weights.edges.slice();
        newEdges[index] = newType;
        const weights = {nodes: this.state.weights.nodes, edges: newEdges};
        this.setState({weights}, () => this.fire());
      };
      return (
        <EdgeTypeConfig
          key={wnt.type.prefix}
          weightedType={wnt}
          onChange={onChange}
        />
      );
    });
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
