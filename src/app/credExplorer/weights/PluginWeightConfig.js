// @flow

import React from "react";
import deepEqual from "lodash.isequal";
import {
  NodeTypeConfig,
  defaultWeightedNodeType,
  type WeightedNodeType,
} from "./NodeTypeConfig";
import {
  EdgeTypeConfig,
  defaultWeightedEdgeType,
  type WeightedEdgeType,
} from "./EdgeTypeConfig";
import {StaticPluginAdapter} from "../../adapters/pluginAdapter";
import {styledVariable} from "./EdgeTypeConfig";

export type WeightedTypes = {|
  +nodes: $ReadOnlyArray<WeightedNodeType>,
  +edges: $ReadOnlyArray<WeightedEdgeType>,
|};

export type Props = {|
  +adapter: StaticPluginAdapter,
  +onChange: (WeightedTypes) => void,
|};
export type State = {|nodes: WeightedNodeType[], edges: WeightedEdgeType[]|};

export class PluginWeightConfig extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const nodes = this.props.adapter.nodeTypes().map(defaultWeightedNodeType);
    const edges = this.props.adapter.edgeTypes().map(defaultWeightedEdgeType);
    this.state = {nodes, edges};
  }

  fire() {
    this.props.onChange({nodes: this.state.nodes, edges: this.state.edges});
  }

  componentDidMount() {
    this.fire();
  }

  _renderNodeWeightControls() {
    return this.state.nodes.map((wnt: WeightedNodeType) => {
      const onChange = (newType: WeightedNodeType) => {
        const index = this.state.nodes.findIndex((x) =>
          deepEqual(x.type, wnt.type)
        );
        const newNodes = this.state.nodes.slice();
        newNodes[index] = newType;
        this.setState({nodes: newNodes}, () => this.fire());
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
    return this.state.edges.map((wnt: WeightedEdgeType) => {
      const onChange = (newType: WeightedEdgeType) => {
        const index = this.state.edges.findIndex((x) =>
          deepEqual(x.type, wnt.type)
        );
        const newEdges = this.state.edges.slice();
        newEdges[index] = newType;
        this.setState({edges: newEdges}, () => this.fire());
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
