// @flow

import React from "react";
import ReactDOM from "react-dom";
import * as d3 from "d3";
import {type NodeAddressT} from "../core/graph";
import {type Point} from "./point";

const INTERPOLATE_LOW = "#00ABE1";
const INTERPOLATE_HIGH = "#90FF03";
const MAX_SIZE_PIXELS = 200;
const HALO_COLOR = "#90FF03";

const BACKGROUND_COLOR = "#313131";

const FONT_SIZE = 14;
const TEXT_VERTICAL_OFFSET_PIXELS = 5.5;

export type NodeVisualizerData = {|
  +address: NodeAddressT,
  +type: string,
  +score: number,
  +description: string,
|};

export type Props = {|
  +node: NodeVisualizerData,
  +point: Point,
  +maxScore: number,
  +onClick: () => void,
|};

export class NodeVisualizer extends React.Component<Props> {
  d3Node: any;

  componentDidMount() {
    this.d3Node = d3.select(ReactDOM.findDOMNode(this));
    this.d3Node
      .select("circle")
      .attr("r", 0)
      .attr("fill", this.color())
      .on("click", this.props.onClick);
    this.d3Node.select("text").attr("font-size", FONT_SIZE);
  }

  updatePoint() {
    this.d3Node
      .select("circle")
      .attr("cx", this.props.point.x)
      .attr("cy", this.props.point.y);
    this.d3Node
      .select("text")
      .attr("x", this.props.point.x + this.radius() + 5)
      .attr("y", this.props.point.y + TEXT_VERTICAL_OFFSET_PIXELS);
  }

  color() {
    const scoreRatio = this.props.node.score / this.props.maxScore;
    const color = d3.interpolate(INTERPOLATE_LOW, INTERPOLATE_HIGH)(scoreRatio);
    return color;
  }

  radius() {
    const scoreRatio = this.props.node.score / this.props.maxScore;
    const color = d3.interpolate(INTERPOLATE_LOW, INTERPOLATE_HIGH)(scoreRatio);
    const radius = Math.sqrt(scoreRatio) * 20 + 3;
    return radius;
  }

  updateScore() {
    this.d3Node
      .select("circle")
      .transition()
      .ease(d3.easeQuad)
      .duration(2000)
      .attr("fill", this.color())
      .attr("r", this.radius());
    this.d3Node
      .select("text")
      .text(Math.floor(this.props.node.score * 1000))
      .attr("fill", this.color());
  }

  componentDidUpdate(prevProps: Props) {
    if (
      prevProps.node.score !== this.props.node.score ||
      prevProps.maxScore !== this.props.maxScore
    ) {
      this.updateScore();
    }
    if (
      prevProps.point.x !== this.props.point.x ||
      prevProps.point.y !== this.props.point.y
    ) {
      this.updatePoint();
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
