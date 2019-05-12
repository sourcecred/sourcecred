// @flow

import React from "react";
import ReactDOM from "react-dom";
import {select} from "d3-selection";
import {easeQuad} from "d3-ease";
import "d3-transition"; // Importing adds .transition() to the selection interface

import {
  type PositionedNode,
  TRANSITION_DURATION,
  nodeRadius,
  nodeColor,
  MIN_COLOR,
} from "./shared";

const ANNOTATION_FONT_SIZE = 14;
const TEXT_VERTICAL_OFFSET_PIXELS = 5.5;
const TEXT_HORIZONTAL_OFFSET_PIXELS = 5.5;

function transition(selection) {
  return selection
    .transition()
    .ease(easeQuad)
    .duration(TRANSITION_DURATION);
}

export type Props = {|
  +positionedNode: PositionedNode,
  +mouseOver: () => void,
  +mouseOut: () => void,
  +onClick: () => void,
|};

/**
 * A class for visualizing an individual node in the cred graph.
 *
 * It renders a single PositionedNode. The position are always immediately
 * rendered, so that the node's position can be smoothly animated if the controlling
 * component is updating the position regularly. The node's score ratio is rendered
 * via the radius and color of the node, and these properties are both transitioned
 * whenever the score ratio changes. The score is rendered via a text element that
 * follows the node around.
 *
 * This component uses a hybrid React/D3 approach where React is responsible for creating
 * nodes, and D3 is responsible for setting all of the attributes. This makes it possible
 * to use D3 transitions and React's data flow architecture. See [this blog post][1]
 * for details:
 *
 * [1]: https://medium.com/@sxywu/on-d3-react-and-a-little-bit-of-flux-88a226f328f3
 *
 * This component is tested via an 'inspection test', which makes it possible to
 * verify that the transitions are coordinated appropriately, and to check for general
 * "look and feel". To run the inspection test, run `yarn start` and then navigate
 * to `localhost:8080/test/NodeRenderer/`. You should run the inspection test any
 * time you change this file.
 *
 * TODO(testing): Consider adding automated unit tests in addition to the inspection test
 * (need to replace the transitions with instantaneous application to test final states).
 */
export class NodeRenderer extends React.Component<Props> {
  d3Node: any; // selection of the root node

  componentDidMount() {
    this.d3Node = select(ReactDOM.findDOMNode(this));
    this.d3Node
      .select("circle")
      .attr("r", 0)
      .attr("fill", MIN_COLOR)
      .on("mouseover", this.props.mouseOver)
      .on("mouseout", this.props.mouseOut)
      .on("click", this.props.onClick);
    this.d3Node
      .select("text")
      .attr("opacity", 0)
      .attr("font-size", ANNOTATION_FONT_SIZE)
      .attr("fill", MIN_COLOR);
    this.d3Node
      .select(".radius-offset-transform")
      .attr("transform", "translate(0,0)");
    this.updatePosition();
    this.updateScore();
  }

  updatePosition() {
    const {x, y} = this.props.positionedNode.position;
    this.d3Node
      .select("circle")
      .attr("cx", x)
      .attr("cy", y);
    this.d3Node
      .select("text")
      .attr("x", x + TEXT_HORIZONTAL_OFFSET_PIXELS)
      .attr("y", y + TEXT_VERTICAL_OFFSET_PIXELS);
  }

  updateScore() {
    const {scoreRatio, score} = this.props.positionedNode.node;
    const radius = nodeRadius(scoreRatio);
    const color = nodeColor(scoreRatio);
    transition(this.d3Node.select("circle"))
      .attr("fill", color)
      .attr("r", radius);
    const text = this.d3Node.select("text").text(Math.floor(score));
    transition(text)
      .attr("fill", color)
      .attr("opacity", 1);
    transition(this.d3Node.select(".radius-offset-transform")).attr(
      "transform",
      `translate(${radius},0)`
    );
  }

  componentDidUpdate(prevProps: Props) {
    const {positionedNode} = prevProps;
    const {node, position} = positionedNode;
    if (
      node.score !== this.props.positionedNode.node.score ||
      node.scoreRatio !== this.props.positionedNode.node.scoreRatio
    ) {
      this.updateScore();
    }
    if (
      position.x !== this.props.positionedNode.position.x ||
      position.y !== this.props.positionedNode.position.y
    ) {
      this.updatePosition();
    }
  }

  render() {
    return (
      <g>
        <circle />
        <g className="radius-offset-transform">
          <text />
        </g>
      </g>
    );
  }
}
