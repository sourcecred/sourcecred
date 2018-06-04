// @flow

import type {_NodeAddress, _EdgeAddress} from "./address";
import {_Address} from "./address";

export const Address = _Address;
export type NodeAddress = _NodeAddress;
export type EdgeAddress = _EdgeAddress;
export type Edge = {|
  +address: EdgeAddress,
  +src: NodeAddress,
  +dst: NodeAddress,
|};

export type Neighbor = {|+node: NodeAddress, +edge: Edge|};
export opaque type Direction = Symbol;
export const IN: Direction = Symbol("IN");
export const OUT: Direction = Symbol("OUT");
export type NeighborsOptions = {|
  +direction: ?Direction,
  +nodePrefix: ?NodeAddress,
  +edgePrefix: ?EdgeAddress,
|};

export opaque type GraphJSON = any; // TODO

export class Graph {
  _nodes: Set<NodeAddress>;
  // If `e` is an Edge in the graph, then:
  // * _edges.get(e.address) `deepEquals` e
  // * _inEdges.get(e.dst) `contains` e
  // * _outEdges.get(e.src) `contains` e
  _edges: Map<EdgeAddress, Edge>;
  _inEdges: Map<NodeAddress, Edge[]>;
  _outEdges: Map<NodeAddress, Edge[]>;

  constructor(): void {
    this._nodes = new Set();
    this._edges = new Map();
    this._inEdges = new Map();
    this._outEdges = new Map();
  }

  addNode(a: NodeAddress): this {
    const _ = a;
    throw new Error("addNode");
  }

  removeNode(a: NodeAddress): this {
    const _ = a;
    throw new Error("removeNode");
  }

  hasNode(a: NodeAddress): boolean {
    const _ = a;
    throw new Error("hasNode");
  }

  nodes(): Iterator<NodeAddress> {
    throw new Error("nodes");
  }

  addEdge({src, dst, address}: Edge): this {
    const _ = {src, dst, address};
    throw new Error("addEdge");
  }

  removeEdge(a: EdgeAddress): this {
    const _ = a;
    throw new Error("removeEdge");
  }

  hasEdge(address: EdgeAddress): boolean {
    const _ = address;
    throw new Error("hasEdge");
  }

  edge(address: EdgeAddress): ?Edge {
    const _ = address;
    throw new Error("edge");
  }

  edges(): Iterator<Edge> {
    throw new Error("edges");
  }

  neighbors(node: NodeAddress, options?: NeighborsOptions): Iterator<Neighbor> {
    const _ = {node, options};
    throw new Error("neighbors");
  }

  copy(): Graph {
    throw new Error("copy");
  }

  toJSON(): GraphJSON {
    throw new Error("toJSON");
  }

  static fromJSON(json: GraphJSON): Graph {
    const _ = json;
    throw new Error("fromJSON");
  }

  static merge(graphs: Iterable<Graph>): Graph {
    const _ = graphs;
    throw new Error("merge");
  }
}
