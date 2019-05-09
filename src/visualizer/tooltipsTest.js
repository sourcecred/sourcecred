// @flow

import React from "react";
import type {Assets} from "../webutil/assets";
import {Tooltips} from "./tooltips";
import {NodeAddress, type Edge, EdgeAddress} from "../core/graph";
import type {Point, PositionedNode, Size, Node} from "./types";
import {GraphVisualizer} from "./GraphVisualizer";
import {GraphVisualizerWrappedRenameMe} from "./GraphVisualizerWrappedReanmeMe";

const CONTAINER_SIZE = {width: 1000, height: 800};
const MAX_SCORE = 1000;

class TooltipsTestCase extends React.Component<{}> {
  positionedNodes: PositionedNode[];
  edges: Edge[];
  constructor() {
    super();
    const positionedNodes: PositionedNode[] = [];
    function addPositionedNode(
      description: string,
      type: string,
      score: number,
      position: Point
    ) {
      const translatedPosition = {
        x: position.x - CONTAINER_SIZE.width / 2,
        y: position.y - CONTAINER_SIZE.height / 2,
      };
      const address = NodeAddress.fromParts([String(positionedNodes.length)]);
      const node = {
        address,
        description,
        type,
        score,
        scoreRatio: score / 1000,
      };
      const positionedNode = {
        node,
        position: translatedPosition,
      };
      positionedNodes.push(positionedNode);
      return address;
    }

    const c1 = addPositionedNode("top-left corner", "CORNER", 1000, {
      x: 20,
      y: 20,
    });
    const c2 = addPositionedNode("top-right corner", "CORNER", 800, {
      x: CONTAINER_SIZE.width - 20,
      y: 20,
    });
    const c4 = addPositionedNode("bottom-left corner", "CORNER", 600, {
      x: 20,
      y: CONTAINER_SIZE.height - 20,
    });
    const c3 = addPositionedNode("bottom-right corner", "CORNER", 400, {
      x: CONTAINER_SIZE.width - 20,
      y: CONTAINER_SIZE.height - 20,
    });
    const x1 = addPositionedNode(
      "superLongSingleWordDescription",
      "NODE",
      200,
      {
        x: 500,
        y: 100,
      }
    );
    const x2 = addPositionedNode(
      "someone wrote a paragraph instead of a short description, gotta accomodate such behaviors",
      "NODE",
      100,
      {x: 300, y: 600}
    );
    const c5 = addPositionedNode("node with 0 score", "NODE", 0, {
      x: 500,
      y: 300,
    });

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
    this.positionedNodes = positionedNodes;
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
          nodes={this.positionedNodes}
          edges={this.edges}
          size={CONTAINER_SIZE}
          showTooltipsFor={this.positionedNodes.map((d) => d.node.address)}
          onHover={() => {}}
          offHover={() => {}}
        />
      </div>
    );
  }
}

type GraphModificationTestCaseState = {
  positionedNodes: Node[],
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
    this.state = {positionedNodes: [], edges: [], size};
    for (let i = 0; i < 10; i++) {
      this.state.positionedNodes.push(this.makeNode());
    }
    for (let j = 0; j < 15; j++) {
      this.state.edges.push(this.makeEdge());
    }
  }

  makeNode(): Node {
    const type = ["FOO", "BAR", "ZOX"][Math.floor(Math.random() * 3)];
    const description = `${type.toLowerCase()}-${this.nodeIndex}`;
    const score = Math.random() * 1000;
    return {
      type,
      score,
      description,
      address: NodeAddress.fromParts([String(this.nodeIndex++)]),
      scoreRatio: score / 1000,
    };
  }

  addNode() {
    this.setState((prevState: GraphModificationTestCaseState) => {
      const {positionedNodes} = prevState;
      positionedNodes.push(this.makeNode());
      return {positionedNodes};
    });
  }

  makeEdge() {
    const {positionedNodes} = this.state;
    const src =
      positionedNodes[Math.floor(Math.random() * positionedNodes.length)]
        .address;
    const dst =
      positionedNodes[Math.floor(Math.random() * positionedNodes.length)]
        .address;
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
          nodes={this.state.positionedNodes}
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
