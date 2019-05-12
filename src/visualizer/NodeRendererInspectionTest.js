// @flow

import React from "react";
import Markdown from "react-markdown";
import dedent from "../util/dedent";
import type {Assets} from "../webutil/assets";
import {NodeAddress} from "../core/graph";
import {NodeRenderer} from "./NodeRenderer";
import {
  BACKGROUND_COLOR,
  TRANSITION_DURATION,
  MAX_RADIUS_PIXELS,
  MIN_RADIUS_PIXELS,
  MIN_COLOR,
  MAX_COLOR,
} from "./shared";

export type State = {|
  score: number,
  +type: string,
  scoreRatio: number,
  +description: string,
  rotationRadians: number,
  mouseOverCount: number,
  mouseOutCount: number,
  onClickCount: number,
|};

export default class NodeRendererInspectionTest extends React.Component<
  {|
    +assets: Assets,
  |},
  State
> {
  state = {
    score: 1000,
    scoreRatio: 1,
    type: "TYPE",
    description: "Unused Description",
    rotationRadians: 0,
    mouseOutCount: 0,
    mouseOverCount: 0,
    onClickCount: 0,
  };

  componentDidMount() {
    setInterval(() => {
      this.setState({rotationRadians: this.state.rotationRadians + 0.01});
    }, 16);
  }

  setScore(score: number) {
    const scoreRatio = score / 1000;
    this.setState({score, scoreRatio});
  }

  render() {
    const node = {
      address: NodeAddress.empty,
      type: this.state.type,
      description: this.state.description,
      score: this.state.score,
      scoreRatio: this.state.scoreRatio,
    };
    const x = Math.cos(this.state.rotationRadians) * 50 + 100;
    const y = Math.sin(this.state.rotationRadians) * 50 + 100;
    const position = {x, y};
    const positionedNode = {position, node};
    const mouseOver = () => {
      this.setState({mouseOverCount: this.state.mouseOverCount + 1});
    };
    const mouseOut = () => {
      this.setState({mouseOutCount: this.state.mouseOutCount + 1});
    };
    const onClick = () => {
      this.setState({onClickCount: this.state.onClickCount + 1});
    };

    const toggleScore = () => {
      if (this.state.score === 0) {
        this.setScore(1000);
      } else {
        this.setScore(0);
      }
    };
    const colorSwatch = (name, color) => (
      <b
        style={{
          width: "100px",
          padding: "8px",
          borderRadius: "3px",
          color: BACKGROUND_COLOR,
          backgroundColor: color,
        }}
      >
        {name}
      </b>
    );

    const source = dedent`
      ## Expected Behavior


      ### On Load

      - Initially, there is an empty black SVG square.
      - Over the course of ${TRANSITION_DURATION}ms,
      a node renderer appears, consisting of a circle and an associated text element.
      - The circle should start at radius 0, and then transition to ${MAX_RADIUS_PIXELS}.
      - The text should start at 0 opacity, and transition to full opacity.
      - Both the circle and the text should start at MIN_COLOR and transition to MAX_COLOR.
      - As the circle grows in radius, the horizontal offset of the text should also change,
      with the result that the text stays a fixed distance from the edge of the circle.
      - Throughout the transition (and afterwards), the circle should be smoothly rotating.

      ### On pushing "Toggle Score"

      When the score changes, the displayed score should immediately update.
      Additionally, there should be three further transitions over the next ${TRANSITION_DURATION}ms:
      - The circle's radius decreases to ${MIN_RADIUS_PIXELS}
      - The circle's color changes to MIN_COLOR
      - The text offset should change with the circle radius, with the effect that the text
      seems to stay a consistent distance away from the node.

      ### Click and Mouse handlers
      - When clicking the node, the "# Clicks" counter should increment.
      - When mousing onto the node, the "# MouseOvers" counter should increment.
      - When mousing off of the node, the "# MouseOuts" counter should increment.

      ### Known Issues
      - There is no transition on the position changes, so if the position changes abrupty,
      the movement of the node is dis-continuous. We expect smoothness to come from whatever
      process is transitioning the positions (i.e. ticks from d3 force layout).
      - The NodeRenderer is not aware of the container size, so it's possible that the score
      display or the circle will fall off the edge of the svg.
      - If the score changes rapidly (faster than once every ${TRANSITION_DURATION} ms), then
      the transitioned properties may never reach their intended values. You can simulate this
      by clicking "toggle score" very quickly. Currently, scores will only change infrequently
      when PageRank is re-run, so this isn't yet an issue.
      - The score text changes instantly. It might be aesthetically nicer to use a [text tween]
      or a [crossfade].

      [text tween]: https://bl.ocks.org/mbostock/7004f92cac972edef365
      [crossfade]: https://bl.ocks.org/mbostock/f7dcecb19c4af317e464
    `;
    return (
      <div style={{width: "600px", margin: "auto"}}>
        <h1>Node Renderer Test</h1>
        <button onClick={toggleScore}>Toggle Score</button>
        <span># Clicks: {this.state.onClickCount} </span>
        <span># MouseOvers: {this.state.mouseOverCount} </span>
        <span># MouseOuts: {this.state.mouseOutCount} </span>
        <svg
          style={{
            height: "200px",
            width: "200px",
            backgroundColor: BACKGROUND_COLOR,
          }}
        >
          <NodeRenderer
            positionedNode={positionedNode}
            mouseOver={mouseOver}
            mouseOut={mouseOut}
            onClick={onClick}
          />
        </svg>
        <div style={{padding: "10px"}}>
          {colorSwatch("MIN_COLOR", MIN_COLOR)}
          {colorSwatch("MAX_COLOR", MAX_COLOR)}
        </div>
        <Markdown source={source} />
      </div>
    );
  }
}
