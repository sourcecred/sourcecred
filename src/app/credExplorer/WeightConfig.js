// @flow

import React from "react";

import {
  type EdgeAddressT,
  type NodeAddressT,
  EdgeAddress,
  NodeAddress,
} from "../../core/graph";

import {type EdgeEvaluator} from "../../core/attribution/pagerank";
import {byEdgeType, byNodeType} from "./edgeWeights";
import LocalStore from "./LocalStore";

// Hacks...
import * as GithubNode from "../../plugins/github/nodes";
import * as GithubEdge from "../../plugins/github/edges";
import * as GitNode from "../../plugins/git/nodes";
import * as GitEdge from "../../plugins/git/edges";

type Props = {
  onChange: (EdgeEvaluator) => void,
};

// The key should be an EdgeAddressT, but a Flow bug prevents this.
type EdgeWeights = {[string]: UserEdgeWeight};
type UserEdgeWeight = {|+logWeight: number, +directionality: number|};
const EDGE_WEIGHTS_KEY = "edgeWeights";
const defaultEdgeWeights = (): EdgeWeights => ({
  [(GithubEdge._Prefix.authors: string)]: {logWeight: 0, directionality: 0.5},
  [(GithubEdge._Prefix.mergedAs: string)]: {logWeight: 0, directionality: 0.5},
  [(GithubEdge._Prefix.references: string)]: {
    logWeight: 0,
    directionality: 0.5,
  },
  [(GithubEdge._Prefix.hasParent: string)]: {logWeight: 0, directionality: 0.5},
  [(GitEdge._Prefix.hasTree: string)]: {logWeight: 0, directionality: 0.5},
  [(GitEdge._Prefix.hasParent: string)]: {logWeight: 0, directionality: 0.5},
  [(GitEdge._Prefix.includes: string)]: {logWeight: 0, directionality: 0.5},
  [(GitEdge._Prefix.becomes: string)]: {logWeight: 0, directionality: 0.5},
  [(GitEdge._Prefix.hasContents: string)]: {logWeight: 0, directionality: 0.5},
});

// The key should be a NodeAddressT, but a Flow bug prevents this.
type NodeWeights = {[string]: UserNodeWeight};
type UserNodeWeight = number /* in log space */;
const NODE_WEIGHTS_KEY = "nodeWeights";
const defaultNodeWeights = (): NodeWeights => ({
  [(GithubNode._Prefix.repo: string)]: 0,
  [(GithubNode._Prefix.issue: string)]: 0,
  [(GithubNode._Prefix.pull: string)]: 0,
  [(GithubNode._Prefix.review: string)]: 0,
  [(GithubNode._Prefix.comment: string)]: 0,
  [(GithubNode._Prefix.userlike: string)]: 0,
  [(GitNode._Prefix.blob: string)]: 0,
  [(GitNode._Prefix.commit: string)]: 0,
  [(GitNode._Prefix.tree: string)]: 0,
  [(GitNode._Prefix.treeEntry: string)]: 0,
});

type State = {
  edgeWeights: EdgeWeights,
  nodeWeights: NodeWeights,
};

export class WeightConfig extends React.Component<Props, State> {
  constructor(props: Props): void {
    super(props);
    this.state = {
      edgeWeights: defaultEdgeWeights(),
      nodeWeights: defaultNodeWeights(),
    };
  }

  componentDidMount() {
    this.setState(
      (state) => ({
        edgeWeights: LocalStore.get(EDGE_WEIGHTS_KEY, state.edgeWeights),
        nodeWeights: LocalStore.get(NODE_WEIGHTS_KEY, state.nodeWeights),
      }),
      () => this.fire()
    );
  }

  render() {
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <EdgeConfig
          edgeWeights={this.state.edgeWeights}
          onChange={(ew) => this.setState({edgeWeights: ew}, () => this.fire())}
        />
        <NodeConfig
          nodeWeights={this.state.nodeWeights}
          onChange={(nw) => this.setState({nodeWeights: nw}, () => this.fire())}
        />
      </div>
    );
  }

  fire() {
    const {edgeWeights, nodeWeights} = this.state;
    LocalStore.set(EDGE_WEIGHTS_KEY, edgeWeights);
    LocalStore.set(NODE_WEIGHTS_KEY, nodeWeights);
    const edgePrefixes = Object.keys(edgeWeights).map((key) => {
      const {logWeight, directionality} = edgeWeights[key];
      const prefix: EdgeAddressT = (key: any);
      return {prefix, weight: 2 ** logWeight, directionality};
    });
    const nodePrefixes = Object.keys(nodeWeights).map((key) => ({
      prefix: ((key: any): NodeAddressT),
      weight: 2 ** nodeWeights[key],
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
    return Object.keys(this.props.edgeWeights).map((key) => {
      const {logWeight} = this.props.edgeWeights[key];
      return (
        <label style={{display: "block"}} key={key}>
          <input
            type="range"
            min={-10}
            max={10}
            step={0.1}
            value={logWeight}
            onChange={(e) => {
              const value: number = e.target.valueAsNumber;
              const edgeWeights = {
                ...this.props.edgeWeights,
                [key]: {...this.props.edgeWeights[key], logWeight: value},
              };
              this.props.onChange(edgeWeights);
            }}
          />{" "}
          {formatNumber(logWeight)}{" "}
          {JSON.stringify(EdgeAddress.toParts((key: any)))}
        </label>
      );
    });
  }

  directionControls() {
    return Object.keys(this.props.edgeWeights).map((key) => {
      const {directionality} = this.props.edgeWeights[key];
      return (
        <label style={{display: "block"}} key={key}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={directionality}
            onChange={(e) => {
              const value: number = e.target.valueAsNumber;
              const edgeWeights = {
                ...this.props.edgeWeights,
                [key]: {...this.props.edgeWeights[key], directionality: value},
              };
              this.props.onChange(edgeWeights);
            }}
          />{" "}
          {directionality.toFixed(2)}{" "}
          {JSON.stringify(EdgeAddress.toParts((key: any)))}
        </label>
      );
    });
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
    const controls = Object.keys(this.props.nodeWeights).map((key) => {
      const currentValue = this.props.nodeWeights[key];
      return (
        <label style={{display: "block"}} key={key}>
          <input
            type="range"
            min={-10}
            max={10}
            step={0.1}
            value={currentValue}
            onChange={(e) => {
              const value: number = e.target.valueAsNumber;
              const nodeWeights = {...this.props.nodeWeights, [key]: value};
              this.props.onChange(nodeWeights);
            }}
          />{" "}
          {formatNumber(currentValue)}{" "}
          {JSON.stringify(NodeAddress.toParts((key: any)))}
        </label>
      );
    });
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
