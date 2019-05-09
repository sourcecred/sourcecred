// @flow

import * as d3 from "d3";
import * as NullUtil from "../util/null";
import type {Edge, NodeAddressT} from "../core/graph";
import type {Point, Node, PositionedNode} from "./types";
import {radius} from "./constants";

const FORCE_LINK_DISTANCE = 120;
const FORCE_MANY_BODY_STRENGTH = -380;

export class ForceSimulator {
  simulation: any;
  linkForce: any;
  onTick: (Map<NodeAddressT, Point>) => void;

  constructor(onTick: (Map<NodeAddressT, Point>) => void) {
    this.linkForce = d3
      .forceLink()
      .id((d) => d.address)
      .distance(FORCE_LINK_DISTANCE);
    this.simulation = d3
      .forceSimulation()
      .stop() // Assume manual control of the simulation.
      .force("charge", d3.forceManyBody().strength(FORCE_MANY_BODY_STRENGTH))
      .force("link", this.linkForce)
      .force(
        "collide",
        d3.forceCollide().radius((d) => {
          return 5;
        })
      )
      .force("x", d3.forceX())
      .force("y", d3.forceY())
      .alphaTarget(0.02)
      .alphaMin(0.1)
      .on("tick", () => this._doTick());
    this.onTick = onTick;
  }

  updateGraph(
    nodes: $ReadOnlyArray<NodeAddressT>,
    edges: $ReadOnlyArray<Edge>
  ) {
    const addrNodes = nodes.map((address) => ({address}));
    const links = edges.map(({address, src, dst}) => ({
      source: addrNodes.find(({address}) => address === src),
      target: addrNodes.find(({address}) => address === dst),
      address,
    }));
    this.linkForce.links(links);
    this.simulation.nodes(addrNodes);
    this.simulation.restart();
  }

  _doTick() {
    const pointMap = new Map();
    this.simulation
      .nodes()
      .forEach(({address, x, y}) => pointMap.set(address, {x, y}));
    this.onTick(pointMap);
  }
}

type ForceNode = {|
  x: number,
  y: number,
  // We never reference these properties, so we'll let
  // the simulation manage them.
  vx?: number,
  vy?: number,
  index?: number,
|};

export class ForceSimulation {
  nodes: $ReadOnlyArray<Node>;
  forceNodes: ForceNode[];
  addressToForceNode: Map<NodeAddressT, ForceNode>;

  simulation: any; // d3.forceSimulation()
  linkForce: any; // d3.forceLink()

  onTick: () => void;

  constructor(onTick: () => void) {
    this.onTick = onTick;
    this.linkForce = d3.forceLink().distance(FORCE_LINK_DISTANCE);
    this.simulation = d3
      .forceSimulation()
      .force("charge", d3.forceManyBody().strength(-380))
      .force("link", this.linkForce)
      .force("x", d3.forceX())
      .force("y", d3.forceY());
  }

  setNodes(nodes: $ReadOnlyArray<Node>): this {
    // Initialize x and y to NaN because, per the d3-force docs:
    // >> If either x or y is NaN, the position is initialized in a phyllotaxis
    // >> arrangement, so chosen to ensure a deterministic, uniform
    // >> distribution around the origin.
    const defaultForceNode = () => ({x: NaN, y: NaN});
    const forceNodes = nodes.map((node) => {
      const existingNode = this.addressToForceNode.get(node.address);
      const forceNode = NullUtil.orElse(existingNode, defaultForceNode());
      this.addressToForceNode.set(node.address, forceNode);
      return forceNode;
    });
    this.simulation.nodes(forceNodes);
    this.nodes = nodes;
    return this;
  }

  setEdges(edges: $ReadOnlyArray<Edge>): this {
    const links = edges.map(({src, dst}) => ({
      source: NullUtil.get(this.addressToForceNode.get(src)),
      target: NullUtil.get(this.addressToForceNode.get(dst)),
    }));
    this.linkForce.links(links);
    return this;
  }

  positionedNodes(): $ReadOnlyArray<PositionedNode> {
    return this.nodes.map((node) => {
      const forceNode = NullUtil.get(this.addressToForceNode.get(node.address));
      const position = {x: forceNode.x, y: forceNode.y};
      return {node, position};
    });
  }

  restart() {}
}
