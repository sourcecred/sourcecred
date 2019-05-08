// @flow

import React from "react";
import type {Assets} from "../webutil/assets";
import {Tooltips} from "./tooltips";
import {NodeAddress} from "../core/graph";
import {type NodeVisualizerDatum} from "./NodeVisualizer";
import type {Point} from "./point";

const CONTAINER_SIZE = {x: 800, y: 800};
const MAX_SCORE = 1000;
const datums: NodeVisualizerDatum[] = [];
function addDatum(
  description: string,
  type: string,
  score: number,
  position: Point
) {
  const translatedPosition = {
    x: position.x - CONTAINER_SIZE.x / 2,
    y: position.y - CONTAINER_SIZE.y / 2,
  };
  const address = NodeAddress.fromParts([String(datums.length)]);
  const node = {address, description, type, score};
  const datum = {
    node,
    position: translatedPosition,
    scoreRatio: score / MAX_SCORE,
  };
  datums.push(datum);
}

addDatum("top-left corner", "NODE", 100, {x: 0, y: 0});
addDatum("top-right corner", "NODE", 100, {x: CONTAINER_SIZE.x, y: 0});
addDatum("bottom-left corner", "NODE", 100, {x: 0, y: CONTAINER_SIZE.y});
addDatum("bottom-right corner", "NODE", 100, {
  x: CONTAINER_SIZE.x,
  y: CONTAINER_SIZE.y,
});
addDatum("super-long-single-word-description", "NODE", 100, {x: 100, y: 100});
addDatum(
  "someone wrote a paragraph instead of a short description, gotta accomodate such behaviors",
  "NODE",
  100,
  {x: 100, y: 300}
);
addDatum("node with 0 score", "NODE", 0, {x: 500, y: 300});

export default class TooltipsTestWrapper extends React.Component<{|
  +assets: Assets,
|}> {
  render() {
    return (
      <div
        style={{
          backgroundColor: "aliceblue",
          width: CONTAINER_SIZE.x + "px",
          height: CONTAINER_SIZE.y + "px",
          margin: "50px",
          padding: "50px",
        }}
      >
        {datums.map((d) => (
          <Tooltips datum={d} containerSize={CONTAINER_SIZE} />
        ))}
      </div>
    );
  }
}
