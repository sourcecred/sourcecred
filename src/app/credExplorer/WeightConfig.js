// @flow

import React from "react";
import sortBy from "lodash.sortby";

import {type EdgeEvaluator} from "../../core/attribution/pagerank";
import {byEdgeType, byNodeType} from "./edgeWeights";
import {defaultStaticAdapters} from "../adapters/defaultPlugins";
import type {NodeType, EdgeType} from "../adapters/pluginAdapter";

type Props = {|
  +onChange: (EdgeEvaluator) => void,
|};

type WeightedEdgeType = {|
  +type: EdgeType,
  +logWeight: number,
  +directionality: number,
|};
type EdgeWeights = WeightedEdgeType[];
const defaultEdgeWeights = (): EdgeWeights => {
  const result = [];
  for (const type of defaultStaticAdapters().edgeTypes()) {
    result.push({type, logWeight: 0, directionality: 0.5});
  }
  return result;
};

type NodeWeights = WeightedNodeType[];
type WeightedNodeType = {|+type: NodeType, +logWeight: number|};
const defaultNodeWeights = (): NodeWeights => {
  const result = [];
  for (const type of defaultStaticAdapters().nodeTypes()) {
    result.push({type, logWeight: type.defaultWeight});
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
    const edgePrefixes = edgeWeights.map(
      ({type, logWeight, directionality}) => ({
        prefix: type.prefix,
        weight: 2 ** logWeight,
        directionality,
      })
    );
    const nodePrefixes = nodeWeights.map(({type, logWeight}) => ({
      prefix: type.prefix,
      weight: 2 ** logWeight,
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
    return sortedWeights.map(({type, directionality, logWeight}) => (
      <label style={{display: "block"}} key={type.prefix}>
        <input
          type="range"
          min={-10}
          max={10}
          step={0.1}
          value={logWeight}
          onChange={(e) => {
            const value: number = e.target.valueAsNumber;
            const edgeWeights = this.props.edgeWeights.filter(
              (x) => x.type.prefix !== type.prefix
            );
            edgeWeights.push({type, logWeight: value, directionality});
            this.props.onChange(edgeWeights);
          }}
        />{" "}
        {formatNumber(logWeight)} {`${type.forwardName}/${type.backwardName}`}
      </label>
    ));
  }

  directionControls() {
    const sortedWeights = sortBy(
      this.props.edgeWeights,
      ({type}) => type.prefix
    );
    return sortedWeights.map(({type, directionality, logWeight}) => (
      <label style={{display: "block"}} key={type.prefix}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={directionality}
          onChange={(e) => {
            const value: number = e.target.valueAsNumber;
            const edgeWeights = this.props.edgeWeights.filter(
              (x) => x.type.prefix !== type.prefix
            );
            edgeWeights.push({type, directionality: value, logWeight});
            this.props.onChange(edgeWeights);
          }}
        />{" "}
        {directionality.toFixed(2)} {type.forwardName}
      </label>
    ));
  }
  render() {
    return (
      <div>
        <h2>Edge weights (in log space)</h2>
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

    const controls = sortedWeights.map(({type, logWeight}) => (
      <label style={{display: "block"}} key={type.prefix}>
        <input
          type="range"
          min={-10}
          max={10}
          step={0.1}
          value={logWeight}
          onChange={(e) => {
            const value: number = e.target.valueAsNumber;
            const nodeWeights = this.props.nodeWeights.filter(
              (x) => x.type.prefix !== type.prefix
            );
            nodeWeights.push({type, logWeight: value});
            this.props.onChange(nodeWeights);
          }}
        />{" "}
        {formatNumber(logWeight)} {type.name}
      </label>
    ));
    return (
      <div>
        <h2>Node weights (in log space)</h2>
        {controls}
      </div>
    );
  }
}

function formatNumber(n: number) {
  let x = n.toFixed(1);
  if (!x.startsWith("-")) {
    x = "+" + x;
  }
  return x.replace("-", "\u2212");
}
