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

// Hacks...
import * as GithubNode from "../../plugins/github/nodes";
import * as GithubEdge from "../../plugins/github/edges";
import * as GitNode from "../../plugins/git/nodes";
import * as GitEdge from "../../plugins/git/edges";

type Props = {
  onChange: (EdgeEvaluator) => void,
};

type UserEdgeWeight = {|+logWeight: number, +directionality: number|};
type UserNodeWeight = number /* in log space */;

const defaultEdgeWeights = (): Map<EdgeAddressT, UserEdgeWeight> =>
  new Map()
    .set(GithubEdge._Prefix.authors, {logWeight: 0, directionality: 0.5})
    .set(GithubEdge._Prefix.mergedAs, {logWeight: 0, directionality: 0.5})
    .set(GithubEdge._Prefix.references, {logWeight: 0, directionality: 0.5})
    .set(GithubEdge._Prefix.hasParent, {logWeight: 0, directionality: 0.5})
    .set(GitEdge._Prefix.hasTree, {logWeight: 0, directionality: 0.5})
    .set(GitEdge._Prefix.hasParent, {logWeight: 0, directionality: 0.5})
    .set(GitEdge._Prefix.includes, {logWeight: 0, directionality: 0.5})
    .set(GitEdge._Prefix.becomes, {logWeight: 0, directionality: 0.5})
    .set(GitEdge._Prefix.hasContents, {logWeight: 0, directionality: 0.5});

const defaultNodeWeights = (): Map<NodeAddressT, UserNodeWeight> =>
  new Map()
    .set(GithubNode._Prefix.repo, 0)
    .set(GithubNode._Prefix.issue, 0)
    .set(GithubNode._Prefix.pull, 0)
    .set(GithubNode._Prefix.review, 0)
    .set(GithubNode._Prefix.comment, 0)
    .set(GithubNode._Prefix.userlike, 0)
    .set(GitNode._Prefix.blob, 0)
    .set(GitNode._Prefix.commit, 0)
    .set(GitNode._Prefix.tree, 0)
    .set(GitNode._Prefix.treeEntry, 0);

type State = {
  edgeWeights: Map<EdgeAddressT, UserEdgeWeight>,
  nodeWeights: Map<NodeAddressT, UserNodeWeight>,
};

export class WeightConfig extends React.Component<Props, State> {
  constructor(props: Props): void {
    super(props);
    this.state = {
      edgeWeights: defaultEdgeWeights(),
      nodeWeights: defaultNodeWeights(),
    };
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

  componentDidMount() {
    this.fire();
  }

  fire() {
    const {edgeWeights, nodeWeights} = this.state;
    const edgePrefixes = Array.from(edgeWeights.entries()).map(
      ([prefix, {logWeight, directionality}]) => ({
        prefix,
        weight: 2 ** logWeight,
        directionality,
      })
    );
    const nodePrefixes = Array.from(nodeWeights.entries()).map(
      ([prefix, logWeight]) => ({prefix, weight: 2 ** logWeight})
    );
    const edgeEvaluator = byNodeType(byEdgeType(edgePrefixes), nodePrefixes);
    this.props.onChange(edgeEvaluator);
  }
}

class EdgeConfig extends React.Component<{
  edgeWeights: Map<EdgeAddressT, UserEdgeWeight>,
  onChange: (Map<EdgeAddressT, UserEdgeWeight>) => void,
}> {
  render() {
    const controls = [];
    for (const [key, currentValue] of this.props.edgeWeights.entries()) {
      controls.push(
        <label style={{display: "block"}} key={key}>
          <input
            type="range"
            min={-10}
            max={10}
            step={0.1}
            value={currentValue.logWeight}
            onChange={(e) => {
              const value: number = e.target.valueAsNumber;
              const edgeWeights = new Map(this.props.edgeWeights);
              const oldValue = edgeWeights.get(key);
              if (oldValue == null) {
                throw new Error(key);
              }
              edgeWeights.set(key, {...oldValue, logWeight: value});
              this.props.onChange(edgeWeights);
            }}
          />{" "}
          {formatNumber(currentValue.logWeight)}{" "}
          {JSON.stringify(EdgeAddress.toParts(key))}
        </label>
      );
    }
    return (
      <div>
        <h2>Edge weights (in log space)</h2>
        {controls}
      </div>
    );
  }
}

class NodeConfig extends React.Component<{
  nodeWeights: Map<NodeAddressT, UserNodeWeight>,
  onChange: (Map<NodeAddressT, UserNodeWeight>) => void,
}> {
  render() {
    const controls = [];
    for (const [key, currentValue] of this.props.nodeWeights.entries()) {
      controls.push(
        <label style={{display: "block"}} key={key}>
          <input
            type="range"
            min={-10}
            max={10}
            step={0.1}
            value={currentValue}
            onChange={(e) => {
              const value: number = e.target.valueAsNumber;
              const nodeWeights = new Map(this.props.nodeWeights);
              nodeWeights.set(key, value);
              this.props.onChange(nodeWeights);
            }}
          />{" "}
          {formatNumber(currentValue)}{" "}
          {JSON.stringify(NodeAddress.toParts(key))}
        </label>
      );
    }
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
