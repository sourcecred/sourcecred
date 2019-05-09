// @flow

import React from "react";
import ReactDOM from "react-dom";

import {type Edge, type NodeAddressT, type EdgeAddressT} from "../core/graph";

import {GraphVisualizer} from "./GraphVisualizer";

import * as d3 from "d3";

import * as NullUtil from "../util/null";
import {type Point} from "./types";
import {ForceSimulator} from "./forceSimulator";
import {BACKGROUND_COLOR} from "./constants";
import {Tooltips} from "./tooltips";
import type {DescribedNode, VizNode, Size} from "./types";

export type {DescribedNode};

export type Props = {|
  +nodes: $ReadOnlyArray<DescribedNode>,
  +edges: $ReadOnlyArray<Edge>,
|};

export type State = {|
  pointMap: Map<NodeAddressT, Point>,
  selectedNode: NodeAddressT | null,
  hoveredNode: NodeAddressT | null,
  // x and y size of the graph visualizer
  // Used for tooltip alignment, etc
  size: Size,
|};

/**
 * A Graph Visualizer which straddles the boundary between React and D3.
 *
 * The general approach is to have React manage maintain the existence of nodes,
 * and D3 manage all attribute updates.
 *
 * This is based on [a post by @sxywu][1]:
 *
 * One might ask: why not just do everything in D3? You can see a prototype of this
 * code which took that approach [here][2]. I felt that doing
 * everything in D3 made it harder to reason about how the parent component
 * should communicate updates to the child (e.g. if we add new nodes and edges).
 * Also, I think that reading DOM generation code in React is much easier to grok
 * than a whirlwind of enters/updates.
 *
 * One might also ask: why not just do everything in React? The short answer is
 * I want to use D3 transitions, which means giving D3 control over attribute
 * application. Also, I want to use the d3-force-layout module, and that module
 * really expects to be in the drivers seat (it mutates the input data to set
 * the simulation data on the nodes).
 *
 * One might now ask: is this approach safe/kosher from a React perspective?
 * Does changing the attributes "behind React's back" risk angering the React
 * gods? According to a react dev in [this StackOverflow answer][3]:
 *
 * >> It's 100% kosher to create an empty <div> in React and populate it by
 * >> hand; it's even okay to modify the properties of a React-rendered element as
 * >> long as you don't later try to change its properties in React (causing React
 * >> to perform DOM updates)
 *
 * If you're interested in a comparison of approaches for integrating D3 and React,
 * I recommend [this post][4].

 * [1]: https://medium.com/@sxywu/on-d3-react-and-a-little-bit-of-flux-88a226f328f3
 * [2]: https://github.com/sourcecred/odyssey-hackathon/blob/master/src/graphviz/OdysseyGraphViz.js
 * [3]: https://stackoverflow.com/questions/23530716/react-how-much-can-i-manipulate-the-dom-react-has-rendered/23572967#23572967
 * [4]: https://medium.com/@tibotiber/react-d3-js-balancing-performance-developer-experience-4da35f912484
 */
export class GraphVisualizerWrappedRenameMe extends React.Component<
  Props,
  State
> {
  simulation: ForceSimulator;

  constructor(props: Props) {
    super(props);
    this.state = {
      pointMap: new Map(),
      selectedNode: null,
      hoveredNode: null,
      size: {width: 800, height: 800},
    };
  }

  componentDidMount() {
    this.simulation = new ForceSimulator((pointMap: Map<NodeAddressT, Point>) =>
      this.setState({pointMap})
    );
    this.simulation.updateGraph(
      this.props.nodes.map((x) => x.address),
      this.props.edges
    );
  }

  componentDidUpdate() {
    this.simulation.updateGraph(
      this.props.nodes.map((x) => x.address),
      this.props.edges
    );
  }

  render() {
    const maxScore = d3.max(this.props.nodes, (n) => n.score);
    const getPosition: (NodeAddressT) => Point = (address: NodeAddressT) => {
      const defaultPoint: Point = ({x: 0, y: 0}: any);
      const retrievedPoint: ?Point = this.state.pointMap.get(address);
      return NullUtil.orElse(retrievedPoint, defaultPoint);
    };
    const viznodes: $ReadOnlyArray<VizNode> = this.props.nodes.map((n) => {
      const scoreRatio = n.score / maxScore;
      const position = getPosition(n.address);
      return {node: n, position, scoreRatio};
    });
    const onHover = (a: NodeAddressT) => {
      console.log(a);
      this.setState({hoveredNode: a});
    };
    const offHover = () => {
      this.setState({hoveredNode: null});
    };
    const tooltipsFor =
      this.state.hoveredNode != null ? [this.state.hoveredNode] : [];
    return (
      <GraphVisualizer
        nodes={viznodes}
        edges={this.props.edges}
        showTooltipsFor={tooltipsFor}
        size={this.state.size}
        onHover={onHover}
        offHover={offHover}
      />
    );
  }
}
