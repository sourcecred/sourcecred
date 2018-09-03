// @flow

import React from "react";
import sortBy from "lodash.sortby";

import {type EdgeEvaluator} from "../../core/attribution/pagerank";
import {byEdgeType, byNodeType} from "./edgeWeights";
import {defaultStaticAdapters} from "../adapters/defaultPlugins";
import type {NodeType, EdgeType} from "../adapters/pluginAdapter";
import {WeightSlider} from "./weights/WeightSlider";
import {DirectionalitySlider} from "./weights/DirectionalitySlider";

type Props = {|
  +onChange: (EdgeEvaluator) => void,
|};

type WeightedEdgeType = {|
  +type: EdgeType,
  +weight: number,
  +directionality: number,
|};
type EdgeWeights = WeightedEdgeType[];
const defaultEdgeWeights = (): EdgeWeights => {
  const result = [];
  for (const type of defaultStaticAdapters().edgeTypes()) {
    result.push({type, weight: 1.0, directionality: 0.5});
  }
  return result;
};

type NodeWeights = WeightedNodeType[];
type WeightedNodeType = {|+type: NodeType, +weight: number|};
const defaultNodeWeights = (): NodeWeights => {
  const result = [];
  for (const type of defaultStaticAdapters().nodeTypes()) {
    result.push({type, weight: type.defaultWeight});
  }
  return result;
};

type State = {
  edgeWeights: EdgeWeights,
  nodeWeights: NodeWeights,
  expanded: boolean,
};

export class WeightConfig extends React.Component<Props, State> {
  constructor(props: Props): void {
    super(props);
    this.state = {
      edgeWeights: defaultEdgeWeights(),
      nodeWeights: defaultNodeWeights(),
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
          style={{float: "right"}}
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
            <EdgeConfig
              edgeWeights={this.state.edgeWeights}
              onChange={(ew) =>
                this.setState({edgeWeights: ew}, () => this.fire())
              }
            />
            <NodeConfig
              nodeWeights={this.state.nodeWeights}
              onChange={(nw) =>
                this.setState({nodeWeights: nw}, () => this.fire())
              }
            />
          </div>
        )}
      </React.Fragment>
    );
  }

  fire() {
    const {edgeWeights, nodeWeights} = this.state;
    const edgePrefixes = edgeWeights.map(({type, weight, directionality}) => ({
      prefix: type.prefix,
      weight,
      directionality,
    }));
    const nodePrefixes = nodeWeights.map(({type, weight}) => ({
      prefix: type.prefix,
      weight,
    }));
    const edgeEvaluator = byNodeType(byEdgeType(edgePrefixes), nodePrefixes);
    this.props.onChange(edgeEvaluator);
  }
}

class EdgeConfig extends React.Component<{
  edgeWeights: EdgeWeights,
  onChange: (EdgeWeights) => void,
}> {
  weightControls() {
    const sortedWeights = sortBy(
      this.props.edgeWeights,
      ({type}) => type.prefix
    );
    return sortedWeights.map(({type, directionality, weight}) => {
      const onChange = (value) => {
        const edgeWeights = this.props.edgeWeights.filter(
          (x) => x.type.prefix !== type.prefix
        );
        edgeWeights.push({type, weight: value, directionality});
        this.props.onChange(edgeWeights);
      };
      return (
        <WeightSlider
          key={type.prefix}
          weight={weight}
          name={`${type.forwardName} / ${type.backwardName}`}
          onChange={onChange}
        />
      );
    });
  }

  directionControls() {
    const sortedWeights = sortBy(
      this.props.edgeWeights,
      ({type}) => type.prefix
    );
    return sortedWeights.map(({type, directionality, weight}) => {
      const onChange = (value: number) => {
        const edgeWeights = this.props.edgeWeights.filter(
          (x) => x.type.prefix !== type.prefix
        );
        edgeWeights.push({type, directionality: value, weight});
        this.props.onChange(edgeWeights);
      };
      return (
        <DirectionalitySlider
          name={type.forwardName}
          key={type.prefix}
          directionality={directionality}
          onChange={onChange}
        />
      );
    });
  }
  render() {
    return (
      <div>
        <h2>Edge weights</h2>
        {this.weightControls()}
        <h2>Edge directionality</h2>
        {this.directionControls()}
      </div>
    );
  }
}

class NodeConfig extends React.Component<{
  nodeWeights: NodeWeights,
  onChange: (NodeWeights) => void,
}> {
  render() {
    const sortedWeights = sortBy(
      this.props.nodeWeights,
      ({type}) => type.prefix
    );

    const controls = sortedWeights.map(({type, weight}) => {
      const onChange = (value) => {
        const nodeWeights = this.props.nodeWeights.filter(
          (x) => x.type.prefix !== type.prefix
        );
        nodeWeights.push({type, weight: value});
        this.props.onChange(nodeWeights);
      };
      return (
        <WeightSlider
          key={type.prefix}
          weight={weight}
          name={type.name}
          onChange={onChange}
        />
      );
    });
    return (
      <div>
        <h2>Node weights</h2>
        {controls}
      </div>
    );
  }
}
