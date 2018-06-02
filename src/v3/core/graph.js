// @flow

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

export function toNodeAddress(arr: $ReadOnlyArray<string>): NodeAddress {
  const _ = arr;
  throw new Error("toNodeAddress");
}
export function fromNodeAddress(n: NodeAddress): string[] {
  const _ = n;
  throw new Error("fromNodeAddress");
}

export function toEdgeAddress(arr: $ReadOnlyArray<string>): EdgeAddress {
  const _ = arr;
  throw new Error("toEdgeAddress");
}
export function fromEdgeAddress(n: EdgeAddress): string[] {
  const _ = n;
  throw new Error("fromEdgeAddress");
}

export class Graph {
  constructor(): void {
    throw new Error("constructor");
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
