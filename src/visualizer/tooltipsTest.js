// @flow

import React from "react";
import type {Assets} from "../webutil/assets";
import {Tooltips} from "./tooltips";
import {NodeAddress, type Edge, EdgeAddress} from "../core/graph";
import type {Point, VizNode, Size, DescribedNode} from "./types";
import {GraphVisualizer} from "./GraphVisualizer";
import {GraphVisualizerWrappedRenameMe} from "./GraphVisualizerWrappedReanmeMe";

const CONTAINER_SIZE = {width: 1000, height: 800};
const MAX_SCORE = 1000;

class TooltipsTestCase extends React.Component<{}> {
  datums: VizNode[];
  edges: Edge[];
  constructor() {
    super();
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
    this.datums = datums;
    this.edges = edges;
  }
  render() {
    return (
      <div
        style={{
          backgroundColor: "aliceblue",
          margin: "10px",
          padding: "10px",
        }}
      >
        <h1>Tooltips Positioning Test </h1>
        <GraphVisualizer
          nodes={this.datums}
          edges={this.edges}
          size={CONTAINER_SIZE}
          showTooltipsFor={this.datums.map((d) => d.node.address)}
          onHover={() => {}}
          offHover={() => {}}
        />
      </div>
    );
  }
}

type GraphModificationTestCaseState = {
  datums: DescribedNode[],
  edges: Edge[],
  size: Size,
};
export class GraphModificationTestCase extends React.Component<
  {},
  GraphModificationTestCaseState
> {
  nodeIndex: number;
  edgeIndex: number;

  constructor() {
    super();
    this.nodeIndex = 0;
    this.edgeIndex = 0;
    const size = {width: 800, height: 800};
    this.state = {datums: [], edges: [], size};
    for (let i = 0; i < 10; i++) {
      this.state.datums.push(this.makeNode());
    }
    for (let j = 0; j < 15; j++) {
      this.state.edges.push(this.makeEdge());
    }
  }

  makeNode() {
    const type = ["FOO", "BAR", "ZOX"][Math.floor(Math.random() * 3)];
    const description = `${type.toLowerCase()}-${this.nodeIndex}`;
    return {
      type,
      score: Math.random() * 1000,
      description,
      address: NodeAddress.fromParts([String(this.nodeIndex++)]),
    };
  }

  addNode() {
    this.setState((prevState: GraphModificationTestCaseState) => {
      const {datums} = prevState;
      datums.push(this.makeNode());
      return {datums};
    });
  }

  makeEdge() {
    const {datums} = this.state;
    const src = datums[Math.floor(Math.random() * datums.length)].address;
    const dst = datums[Math.floor(Math.random() * datums.length)].address;
    const address = EdgeAddress.fromParts([String(this.edgeIndex++)]);
    return {src, dst, address};
  }

  addEdge() {
    this.setState((prevState: GraphModificationTestCaseState) => {
      prevState.edges.push(this.makeEdge());
      return {edges: prevState.edges};
    });
  }

  render() {
    return (
      <div
        style={{
          backgroundColor: "#abc123",
          margin: "10px",
          padding: "10px",
        }}
      >
        <button onClick={() => this.addNode()}>Add Node</button>
        <button onClick={() => this.addEdge()}>Add Edge</button>
        <h1>Graph Modification Test</h1>
        <GraphVisualizerWrappedRenameMe
          nodes={this.state.datums}
          edges={this.state.edges}
        />
      </div>
    );
  }
}

export default class TooltipsTestWrapper extends React.Component<{|
  +assets: Assets,
|}> {
  render() {
    return (
      <div>
        <TooltipsTestCase />;
        <GraphModificationTestCase />
      </div>
    );
  }
}
