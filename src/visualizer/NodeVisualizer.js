// @flow

import React from "react";
import ReactDOM from "react-dom";
import * as d3 from "d3";
import {type NodeAddressT} from "../core/graph";
import {type Point} from "./point";
import type {DescribedNode} from "./describedNode";

import {radius, color, type ScoreRatio} from "./constants";

const BACKGROUND_COLOR = "#313131";

const ANNOTATION_FONT_SIZE = 14;
const TEXT_VERTICAL_OFFSET_PIXELS = 5.5;
const TEXT_HORIZONTAL_OFFSET_PIXELS = 5.5;

export type NodeVisualizerDatum = {|
  +node: DescribedNode,
  +position: Point,
  +scoreRatio: number,
|};

export type Props = {|
  +datum: NodeVisualizerDatum,
  +onClick: () => void,
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
      .attr("fill", color(this.props.datum.scoreRatio))
      .on("click", this.props.onClick)
      .on("mouseover", this.props.mouseOver)
      .on("mouseout", this.props.mouseOff);
    this.d3Node.select("text").attr("font-size", ANNOTATION_FONT_SIZE);
  }

  updatePosition() {
    this.d3Node
      .select("circle")
      .attr("cx", this.props.datum.position.x)
      .attr("cy", this.props.datum.position.y);
    this.d3Node
      .select("text")
      .attr(
        "x",
        this.props.datum.position.x +
          radius(this.props.datum.scoreRatio) +
          TEXT_HORIZONTAL_OFFSET_PIXELS
      )
      .attr("y", this.props.datum.position.y + TEXT_VERTICAL_OFFSET_PIXELS);
  }

  updateScore() {
    this.d3Node
      .select("circle")
      .transition()
      .ease(d3.easeQuad)
      .duration(2000)
      .attr("fill", color(this.props.datum.scoreRatio))
      .attr("r", radius(this.props.datum.scoreRatio));
    this.d3Node
      .select("text")
      .text(Math.floor(this.props.datum.node.score * 1000))
      .attr("fill", color(this.props.datum.scoreRatio));
  }

  componentDidUpdate(prevProps: Props) {
    if (
      prevProps.datum.node.score !== this.props.datum.node.score ||
      prevProps.datum.scoreRatio !== this.props.datum.scoreRatio
    ) {
      this.updateScore();
    }
    if (
      prevProps.datum.position.x !== this.props.datum.position.x ||
      prevProps.datum.position.y !== this.props.datum.position.y
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
