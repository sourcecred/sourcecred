// @flow

import React from "react";
import ReactDOM from "react-dom";
import * as d3 from "d3";
import {type NodeAddressT} from "../core/graph";
import {type Point} from "./types";
import type {PositionedNode, Node} from "./types";

import {radius, color, type ScoreRatio} from "./constants";

const BACKGROUND_COLOR = "#313131";

const ANNOTATION_FONT_SIZE = 14;
const TEXT_VERTICAL_OFFSET_PIXELS = 5.5;
const TEXT_HORIZONTAL_OFFSET_PIXELS = 5.5;

export type Props = {|
  +positionedNode: PositionedNode,
  +mouseOver: () => void,
  +mouseOff: () => void,
|};

export class NodeVisualizer extends React.Component<Props> {
  d3Node: any;

  componentDidMount() {
    this.d3Node = d3.select(ReactDOM.findDOMNode(this));
    this.d3Node
      .select("circle")
      .attr("r", 0)
      .attr("fill", color(this.props.positionedNode.node.scoreRatio))
      .on("mouseover", this.props.mouseOver)
      .on("mouseout", this.props.mouseOff);
    this.d3Node.select("text").attr("font-size", ANNOTATION_FONT_SIZE);
    this.updatePosition();
    this.updateScore();
  }

  updatePosition() {
    this.d3Node
      .select("circle")
      .attr("cx", this.props.positionedNode.position.x)
      .attr("cy", this.props.positionedNode.position.y);
    this.d3Node
      .select("text")
      .attr(
        "x",
        this.props.positionedNode.position.x +
          radius(this.props.positionedNode.node.scoreRatio) +
          TEXT_HORIZONTAL_OFFSET_PIXELS
      )
      .attr(
        "y",
        this.props.positionedNode.position.y + TEXT_VERTICAL_OFFSET_PIXELS
      );
  }

  updateScore() {
    this.d3Node
      .select("circle")
      .transition()
      .ease(d3.easeQuad)
      .duration(2000)
      .attr("fill", color(this.props.positionedNode.node.scoreRatio))
      .attr("r", radius(this.props.positionedNode.node.scoreRatio));
    this.d3Node
      .select("text")
      .text(Math.floor(this.props.positionedNode.node.score))
      .attr("fill", color(this.props.positionedNode.node.scoreRatio));
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
        <text />
      </g>
    );
  }
}
