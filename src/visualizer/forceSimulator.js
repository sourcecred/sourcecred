// @flow

import * as d3 from "d3";
import type {Edge, NodeAddressT} from "../core/graph";
import {type Point} from "./types";

export class ForceSimulator {
  simulation: any;
  linkForce: any;
  onTick: (Map<NodeAddressT, Point>) => void;

  constructor(onTick: (Map<NodeAddressT, Point>) => void) {
    this.linkForce = d3
      .forceLink()
      .id((d) => d.address)
      .distance(120);
    this.simulation = d3
      .forceSimulation()
      .force("charge", d3.forceManyBody().strength(-380))
      .force("link", this.linkForce)
      /*
      .force(
        "collide",
        d3.forceCollide().radius((d) => {
          return 5;
        })
      )
      */
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
  }

  _doTick() {
    const pointMap = new Map();
    this.simulation
      .nodes()
      .forEach(({address, x, y}) => pointMap.set(address, {x, y}));
    this.onTick(pointMap);
  }
}
