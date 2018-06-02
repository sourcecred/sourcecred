// @flow

import stringify from "json-stable-stringify";
export opaque type NodeAddress = string;
export opaque type EdgeAddress = string;
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

const NODE_PREFIX = "N";
const EDGE_PREFIX = "E";
const SEPARATOR = "\0";

function isNodeAddress(x: string): boolean {
  return x.startsWith(NODE_PREFIX) && x.endsWith(SEPARATOR);
}
function isEdgeAddress(x: string): boolean {
  return x.startsWith(EDGE_PREFIX) && x.endsWith(SEPARATOR);
}

function assertNodeAddress(x: NodeAddress) {
  if (x == null) {
    throw new Error(String(x));
  }
  if (!isNodeAddress(x)) {
    if (isEdgeAddress(x)) {
      throw new Error(`Expected NodeAddress, got EdgeAddress: ${x}`);
    }
    throw new Error(`Malformed address: ${x}`);
  }
}
function assertEdgeAddress(x: EdgeAddress) {
  if (x == null) {
    throw new Error(String(x));
  }
  if (!isEdgeAddress(x)) {
    if (isNodeAddress(x)) {
      throw new Error(`Expected EdgeAddress, got NodeAddress: ${x}`);
    }
    throw new Error(`Malformed address: ${x}`);
  }
}

function assertAddressArray(arr: $ReadOnlyArray<string>) {
  if (arr == null) {
    throw new Error(String(arr));
  }
  arr.forEach((s: string) => {
    if (s == null) {
      throw new Error(`${String(s)} in ${stringify(arr)}`);
    }
    if (s.indexOf(SEPARATOR) !== -1) {
      throw new Error(`NUL char: ${stringify(arr)}`);
    }
  });
}

export function toNodeAddress(arr: $ReadOnlyArray<string>): NodeAddress {
  assertAddressArray(arr);
  return [NODE_PREFIX, ...arr, ""].join(SEPARATOR);
}

export function fromNodeAddress(n: NodeAddress): string[] {
  assertNodeAddress(n);
  const parts = n.split(SEPARATOR);
  return parts.slice(1, parts.length - 1);
}

export function toEdgeAddress(arr: $ReadOnlyArray<string>): EdgeAddress {
  assertAddressArray(arr);
  return [EDGE_PREFIX, ...arr, ""].join(SEPARATOR);
}

export function fromEdgeAddress(n: EdgeAddress): string[] {
  assertEdgeAddress(n);
  const parts = n.split(SEPARATOR);
  return parts.slice(1, parts.length - 1);
}

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
