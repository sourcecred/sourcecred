// @flow

import React from "react";
import type {Assets} from "../webutil/assets";
import {Tooltips} from "./tooltips";
import {NodeAddress} from "../core/graph";
import type {Point, VizNode} from "./types";

const CONTAINER_SIZE = {width: 800, height: 800};
const MAX_SCORE = 1000;
const datums: VizNode[] = [];
function addDatum(
  description: string,
  type: string,
  score: number,
  position: Point
) {
  const translatedPosition = {
    x: position.x - CONTAINER_SIZE.width / 2,
    y: position.y - CONTAINER_SIZE.height / 2,
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
addDatum("top-right corner", "NODE", 100, {x: CONTAINER_SIZE.width, y: 0});
addDatum("bottom-left corner", "NODE", 100, {x: 0, y: CONTAINER_SIZE.height});
addDatum("bottom-right corner", "NODE", 100, {
  x: CONTAINER_SIZE.width,
  y: CONTAINER_SIZE.height,
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
          width: CONTAINER_SIZE.width + "px",
          height: CONTAINER_SIZE.height + "px",
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
