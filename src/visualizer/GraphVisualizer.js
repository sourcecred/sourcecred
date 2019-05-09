// @flow

import React from "react";
import * as NullUtil from "../util/null";

import type {Edge, NodeAddressT} from "../core/graph";
import type {PositionedNode, Size, Point} from "./types";
import {BACKGROUND_COLOR} from "./constants";
import {Tooltips} from "./tooltips";

export type Props = {|
  +nodes: $ReadOnlyArray<PositionedNode>,
  +edges: $ReadOnlyArray<Edge>,
  +showTooltipsFor: $ReadOnlyArray<NodeAddressT>,
  +size: Size,
  +onHover: (a: NodeAddressT) => void,
  +offHover: () => void,
|};

import {NodeVisualizer} from "./NodeVisualizer";
import {EdgeVisualizer} from "./EdgeVisualizer";

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
export class GraphVisualizer extends React.Component<Props> {
  render() {
    const NodeVisualizers = this.props.nodes.map((n) => (
      <NodeVisualizer
        positionedNode={n}
        key={n.node.address}
        mouseOver={() => this.props.onHover(n.node.address)}
        mouseOff={() => this.props.offHover()}
      />
    ));
    const matchingNode = (address) => {
      return NullUtil.get(
        this.props.nodes.find((x) => x.node.address === address)
      );
    };
    const EdgeVisualizers = this.props.edges.map(({src, dst, address}) => (
      <EdgeVisualizer
        key={address}
        srcPoint={matchingNode(src).position}
        dstPoint={matchingNode(dst).position}
      />
    ));
    const tooltips = this.props.showTooltipsFor.map((addr) => {
      const node = matchingNode(addr);
      return (
        <Tooltips key={addr} datum={node} containerSize={this.props.size} />
      );
    });
    return (
      <div
        style={{
          width: this.props.size.width + "px",
          height: this.props.size.height + "px",
        }}
      >
        <svg
          style={{
            backgroundColor: BACKGROUND_COLOR,
            width: "100%",
            height: "100%",
          }}
        >
          <g
            className="container"
            transform={`translate(${this.props.size.width / 2}, ${this.props
              .size.height / 2})`}
          >
            <g className="edges">{EdgeVisualizers}</g>
            <g className="nodes">{NodeVisualizers}</g>
          </g>
        </svg>
        <div
          className="tooltips-container"
          style={{position: "relative", top: `-${this.props.size.height}px`}}
        >
          {tooltips}
        </div>
      </div>
    );
  }
}
