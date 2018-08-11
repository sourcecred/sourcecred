// @flow

import React from "react";

import {
  type EdgeAddressT,
  type NodeAddressT,
  EdgeAddress,
  NodeAddress,
} from "../../core/graph";

import type {LocalStore} from "../localStore";
import {type EdgeEvaluator} from "../../core/attribution/pagerank";
import {byEdgeType, byNodeType} from "./edgeWeights";
import * as MapUtil from "../../util/map";
import * as NullUtil from "../../util/null";
import {defaultStaticAdapters} from "../adapters/defaultPlugins";

type Props = {|
  +localStore: LocalStore,
  +onChange: (EdgeEvaluator) => void,
|};

type EdgeWeights = Map<EdgeAddressT, UserEdgeWeight>;
type UserEdgeWeight = {|+logWeight: number, +directionality: number|};

const EDGE_WEIGHTS_KEY = "edgeWeights";
const defaultEdgeWeights = (): EdgeWeights => {
  const result = new Map();
  for (const adapter of defaultStaticAdapters()) {
    for (const {prefix} of adapter.edgeTypes()) {
      result.set(prefix, {logWeight: 0, directionality: 0.5});
    }
  }
  return result;
};

type NodeWeights = Map<NodeAddressT, UserNodeWeight>;
type UserNodeWeight = number /* in log space */;
const NODE_WEIGHTS_KEY = "nodeWeights";
const defaultNodeWeights = (): NodeWeights => {
  const result = new Map();
  for (const adapter of defaultStaticAdapters()) {
    for (const {prefix, defaultWeight} of adapter.nodeTypes()) {
      result.set(prefix, Math.log2(defaultWeight));
    }
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
    const {localStore} = this.props;
    this.setState(
      (state) => {
        return {
          edgeWeights: NullUtil.orElse(
            NullUtil.map(localStore.get(EDGE_WEIGHTS_KEY), MapUtil.fromObject),
            state.edgeWeights
          ),
          nodeWeights: NullUtil.orElse(
            NullUtil.map(localStore.get(NODE_WEIGHTS_KEY), MapUtil.fromObject),
            state.nodeWeights
          ),
        };
      },
      () => this.fire()
    );
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
    const {localStore} = this.props;
    const {edgeWeights, nodeWeights} = this.state;
    localStore.set(EDGE_WEIGHTS_KEY, MapUtil.toObject(edgeWeights));
    localStore.set(NODE_WEIGHTS_KEY, MapUtil.toObject(nodeWeights));
    const edgePrefixes = Array.from(edgeWeights.entries()).map(
      ([prefix, {logWeight, directionality}]) => ({
        prefix,
        weight: 2 ** logWeight,
        directionality,
      })
    );
    const nodePrefixes = Array.from(nodeWeights.entries()).map(
      ([prefix, logWeight]) => ({
        prefix,
        weight: 2 ** logWeight,
      })
    );
    const edgeEvaluator = byNodeType(byEdgeType(edgePrefixes), nodePrefixes);
    this.props.onChange(edgeEvaluator);
  }
}

class EdgeConfig extends React.Component<{
  edgeWeights: EdgeWeights,
  onChange: (EdgeWeights) => void,
}> {
  weightControls() {
    return Array.from(this.props.edgeWeights.entries()).map(([key, datum]) => (
      <label style={{display: "block"}} key={key}>
        <input
          type="range"
          min={-10}
          max={10}
          step={0.1}
          value={datum.logWeight}
          onChange={(e) => {
            const value: number = e.target.valueAsNumber;
            const edgeWeights = MapUtil.copy(this.props.edgeWeights).set(key, {
              ...datum,
              logWeight: value,
            });
            this.props.onChange(edgeWeights);
          }}
        />{" "}
        {formatNumber(datum.logWeight)}{" "}
        {JSON.stringify(EdgeAddress.toParts(key))}
      </label>
    ));
  }

  directionControls() {
    return Array.from(this.props.edgeWeights.entries()).map(([key, datum]) => (
      <label style={{display: "block"}} key={key}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={datum.directionality}
          onChange={(e) => {
            const value: number = e.target.valueAsNumber;
            const edgeWeights = MapUtil.copy(this.props.edgeWeights).set(key, {
              ...datum,
              directionality: value,
            });
            this.props.onChange(edgeWeights);
          }}
        />{" "}
        {datum.directionality.toFixed(2)}{" "}
        {JSON.stringify(EdgeAddress.toParts(key))}
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
    const controls = Array.from(this.props.nodeWeights.entries()).map(
      ([key, currentValue]) => (
        <label style={{display: "block"}} key={key}>
          <input
            type="range"
            min={-10}
            max={10}
            step={0.1}
            value={currentValue}
            onChange={(e) => {
              const value: number = e.target.valueAsNumber;
              const nodeWeights = MapUtil.copy(this.props.nodeWeights).set(
                key,
                value
              );
              this.props.onChange(nodeWeights);
            }}
          />{" "}
          {formatNumber(currentValue)}{" "}
          {JSON.stringify(NodeAddress.toParts(key))}
        </label>
      )
    );
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
