// @flow

import React from "react";
import type {Assets} from "../webutil/assets";
import {Tooltips} from "./tooltips";
import {NodeAddress, type Edge, EdgeAddress} from "../core/graph";
import type {Point, VizNode} from "./types";
import {GraphVisualizer} from "./GraphVisualizer";

const CONTAINER_SIZE = {width: 1000, height: 800};
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
  return address;
}

const c1 = addDatum("top-left corner", "CORNER", 1000, {x: 20, y: 20});
const c2 = addDatum("top-right corner", "CORNER", 800, {
  x: CONTAINER_SIZE.width - 20,
  y: 20,
});
const c4 = addDatum("bottom-left corner", "CORNER", 600, {
  x: 20,
  y: CONTAINER_SIZE.height - 20,
});
const c3 = addDatum("bottom-right corner", "CORNER", 400, {
  x: CONTAINER_SIZE.width - 20,
  y: CONTAINER_SIZE.height - 20,
});
const x1 = addDatum("superLongSingleWordDescription", "NODE", 200, {
  x: 500,
  y: 100,
});
const x2 = addDatum(
  "someone wrote a paragraph instead of a short description, gotta accomodate such behaviors",
  "NODE",
  100,
  {x: 300, y: 600}
);
const c5 = addDatum("node with 0 score", "NODE", 0, {x: 500, y: 300});

const edges: Edge[] = [];
const addEdge = (src, dst) => {
  const edge = {
    src,
    dst,
    address: EdgeAddress.fromParts([String(edges.length)]),
  };
  edges.push(edge);
};

addEdge(c1, c2);
addEdge(c2, c3);
addEdge(c3, c4);
addEdge(c4, c1);
addEdge(c1, c5);
addEdge(c2, c5);
addEdge(c3, c5);
addEdge(c4, c5);
addEdge(x1, x2);

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
          margin: "10px",
          padding: "10px",
        }}
      >
        <GraphVisualizer
          nodes={datums}
          edges={edges}
          size={CONTAINER_SIZE}
          showTooltipsFor={datums.map((d) => d.node.address)}
          onHover={() => {}}
          offHover={() => {}}
        />
      </div>
    );
  }
}
