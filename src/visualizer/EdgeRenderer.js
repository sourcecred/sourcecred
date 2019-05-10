// @flow

import React from "react";
import ReactDOM from "react-dom";
import * as d3 from "d3";
import type {Point} from "./types";
import {TRANSITION_DURATION, EDGE_COLOR, EDGE_OPACITY} from "./constants";

export class EdgeRenderer extends React.Component<{|
  +srcPoint: Point,
  +dstPoint: Point,
|}> {
  d3Node: any;

  componentDidMount() {
    this.d3Node = d3.select(ReactDOM.findDOMNode(this));
    this.d3Node
      .select("line")
      .attr("opacity", 0)
      .transition()
      .duration(TRANSITION_DURATION)
      .attr("opacity", EDGE_OPACITY);
    this.update();
  }

  update() {
    this.d3Node
      .select("line")
      .attr("stroke", EDGE_COLOR)
      .attr("x1", this.props.srcPoint.x)
      .attr("y1", this.props.srcPoint.y)
      .attr("x2", this.props.dstPoint.x)
      .attr("y2", this.props.dstPoint.y);
  }

  componentDidUpdate() {
    this.update();
  }

  render() {
    return (
      <g>
        <line />
      </g>
    );
  }
}
