// @flow

import React from "react";
import sortBy from "lodash.sortby";

import {type EdgeEvaluator} from "../../core/attribution/pagerank";
import {byEdgeType, byNodeType} from "./edgeWeights";
import {defaultStaticAdapters} from "../adapters/defaultPlugins";
import {
  NodeTypeConfig,
  defaultWeightedNodeType,
  type WeightedNodeType,
} from "./weights/NodeTypeConfig";
import {
  EdgeTypeConfig,
  defaultWeightedEdgeType,
  type WeightedEdgeType,
} from "./weights/EdgeTypeConfig";
import {styledVariable} from "./weights/EdgeTypeConfig";

type Props = {|
  +onChange: (EdgeEvaluator) => void,
|};

type State = {
  edgeWeights: $ReadOnlyArray<WeightedEdgeType>,
  nodeWeights: $ReadOnlyArray<WeightedNodeType>,
  expanded: boolean,
};

export class WeightConfig extends React.Component<Props, State> {
  constructor(props: Props): void {
    super(props);
    this.state = {
      edgeWeights: defaultStaticAdapters()
        .edgeTypes()
        .map(defaultWeightedEdgeType),
      nodeWeights: defaultStaticAdapters()
        .nodeTypes()
        .map(defaultWeightedNodeType),
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
      ({type, forwardWeight, backwardWeight}) => ({
        prefix: type.prefix,
        forwardWeight,
        backwardWeight,
      })
    );
    const nodePrefixes = nodeWeights.map(({type, weight}) => ({
      prefix: type.prefix,
      weight,
    }));
    const edgeEvaluator = byNodeType(byEdgeType(edgePrefixes), nodePrefixes);
    this.props.onChange(edgeEvaluator);
  }
}

class EdgeConfig extends React.Component<{
  edgeWeights: $ReadOnlyArray<WeightedEdgeType>,
  onChange: ($ReadOnlyArray<WeightedEdgeType>) => void,
}> {
  _renderWeightControls() {
    return sortBy(this.props.edgeWeights, ({type}) => type.prefix).map(
      (weightedEdgeType) => {
        const onChange = (value) => {
          const edgeWeights = this.props.edgeWeights.filter(
            (x) => x.type.prefix !== weightedEdgeType.type.prefix
          );
          edgeWeights.push(value);
          this.props.onChange(edgeWeights);
        };
        return (
          <EdgeTypeConfig
            key={weightedEdgeType.type.prefix}
            weightedType={weightedEdgeType}
            onChange={onChange}
          />
        );
      }
    );
  }

  render() {
    return (
      <div>
        <h2>Edge weights</h2>
        <p>
          Flow cred from {styledVariable("β")} to {styledVariable("α")} when:
        </p>
        {this._renderWeightControls()}
      </div>
    );
  }
}

class NodeConfig extends React.Component<{
  nodeWeights: $ReadOnlyArray<WeightedNodeType>,
  onChange: ($ReadOnlyArray<WeightedNodeType>) => void,
}> {
  _renderControls() {
    return sortBy(this.props.nodeWeights, ({type}) => type.prefix).map(
      (weightedType) => {
        const onChange = (newType) => {
          const nodeWeights = this.props.nodeWeights.filter(
            (x) => x.type.prefix !== weightedType.type.prefix
          );
          nodeWeights.push(newType);
          this.props.onChange(nodeWeights);
        };
        return (
          <NodeTypeConfig weightedType={weightedType} onChange={onChange} />
        );
      }
    );
  }
  render() {
    return (
      <div>
        <h2>Node weights</h2>
        {this._renderControls()}
      </div>
    );
  }
}
