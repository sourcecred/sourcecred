// @flow

import React from "react";
import {OdysseyInstance} from "./instance";
import {GraphVisualizer, type VisualizerNode} from "./GraphVisualizer";
import {type NodeAddressT, type Edge} from "../../core/graph";
import {PagerankGraph} from "../../core/pagerankGraph";
import * as NullUtil from "../../util/null";

export type Props = {|
  +instance: OdysseyInstance,
|};

export type State = {|
  pagerankGraph: PagerankGraph,
  nodes: $ReadOnlyArray<VisualizerNode>,
  edges: $ReadOnlyArray<Edge>,
  selectedNode: NodeAddressT | null,
|};

export class OdysseyInstanceVisualizer extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const {instance} = props;
    const edgeEvaluator = (_unused_edge) => ({toWeight: 1, froWeight: 0.3});
    const pagerankGraph = new PagerankGraph(instance.graph(), edgeEvaluator);
    const {nodes, edges} = computeNodesAndEdges(instance, pagerankGraph);
    this.state = {pagerankGraph, selectedNode: null, nodes, edges};
  }

  async componentDidMount() {
    await this.state.pagerankGraph.runPagerank();
    const {nodes, edges} = computeNodesAndEdges(
      this.props.instance,
      this.state.pagerankGraph
    );
    this.setState({nodes, edges});
  }

  render() {
    return (
      <GraphVisualizer
        nodes={this.state.nodes}
        edges={this.state.edges}
        selectedNode={this.state.selectedNode}
        onSelect={(selectedNode) => this.setState({selectedNode})}
      />
    );
  }
}

function computeNodesAndEdges(
  instance: OdysseyInstance,
  pagerankGraph: PagerankGraph
) {
  const nodes: $ReadOnlyArray<VisualizerNode> = Array.from(
    instance.nodes()
  ).map(({nodeTypeIdentifier, address, description}) => ({
    address,
    type: nodeTypeIdentifier,
    score: NullUtil.get(pagerankGraph.node(address)).score,
    description,
  }));
  const edges: $ReadOnlyArray<Edge> = Array.from(instance.graph().edges());
  return {nodes, edges};
}
