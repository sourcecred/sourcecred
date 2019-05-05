// @flow

import React from "react";
import * as d3 from "d3";

import type {Point} from "./point";
import type {NodeVisualizerDatum} from "./NodeVisualizer";
const TOOLTIP_HORIZONTAL_OFFSET = 40;

export type Props = {|
  +datum: NodeVisualizerDatum,
  +containerSize: Point,
|};

export class Tooltips extends React.Component<Props> {
  render() {
    const left =
      this.props.datum.position.x +
      this.props.containerSize.x / 2 +
      TOOLTIP_HORIZONTAL_OFFSET +
      "px";
    const top =
      this.props.datum.position.y - this.props.containerSize.y / 2 + "px";
    return (
      <div style={{left, top, position: "relative"}}>
        <span>Score: {this.props.datum.node.score}</span>
        <span>Type: {this.props.datum.node.type}</span>
        <span>Description: {this.props.datum.node.description}</span>
      </div>
    );
  }
}
