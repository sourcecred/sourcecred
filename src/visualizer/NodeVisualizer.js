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
      .attr("fill", INTERPOLATE_LOW)
      .attr("r", 0)
      .on("click", this.props.onClick);
  }

  updatePoint() {
    this.d3Node
      .select("circle")
      .attr("cx", this.props.point.x)
      .attr("cy", this.props.point.y);
  }

  updateScore() {
    const scoreRatio = this.props.node.score / this.props.maxScore;
    const radius = Math.sqrt(scoreRatio) * 20 + 3;
    this.d3Node
      .select("circle")
      .transition()
      .ease(d3.easeQuad)
      .duration(1000)
      .attr(
        "fill",
        d3.interpolate(INTERPOLATE_LOW, INTERPOLATE_HIGH)(scoreRatio)
      )
      .attr("r", radius);
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
