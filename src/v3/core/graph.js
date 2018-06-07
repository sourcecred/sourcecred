// @flow

import {makeAddressModule, type AddressModule} from "./address";

export opaque type NodeAddressT: string = string;
export opaque type EdgeAddressT: string = string;
export const NodeAddress: AddressModule<NodeAddressT> = (makeAddressModule({
  name: "NodeAddress",
  nonce: "N",
  otherNonces: new Map().set("E", "EdgeAddress"),
}): AddressModule<string>);
export const EdgeAddress: AddressModule<EdgeAddressT> = (makeAddressModule({
  name: "EdgeAddress",
  nonce: "E",
  otherNonces: new Map().set("N", "NodeAddress"),
}): AddressModule<string>);

export type Edge = {|
  +address: EdgeAddressT,
  +src: NodeAddressT,
  +dst: NodeAddressT,
|};

export type Neighbor = {|+node: NodeAddressT, +edge: Edge|};

export opaque type DirectionT = Symbol;
export const Direction: {|
  +IN: DirectionT,
  +OUT: DirectionT,
  +ANY: DirectionT,
|} = Object.freeze({
  IN: Symbol("IN"),
  OUT: Symbol("OUT"),
  ANY: Symbol("ANY"),
});

export type NeighborsOptions = {|
  +direction: DirectionT,
  +nodePrefix: NodeAddressT,
  +edgePrefix: EdgeAddressT,
|};

export opaque type GraphJSON = any; // TODO

export class Graph {
  // A node `n` is in the graph if `_nodes.has(n)`.
  //
  // An edge `e` is in the graph if `_edges.get(e.address)`
  // is deep-equal to `e`.
  //
  // Invariant: If an edge `e` is in the graph, then `e.src` and `e.dst`
  // are both in the graph.
  _nodes: Set<NodeAddressT>;
  _edges: Map<EdgeAddressT, Edge>;
  _inEdges: Map<NodeAddressT, Edge[]>;
  _outEdges: Map<NodeAddressT, Edge[]>;

  constructor(): void {
    this._nodes = new Set();
    this._edges = new Map();
    this._inEdges = new Map();
    this._outEdges = new Map();
  }

  addNode(a: NodeAddressT): this {
    NodeAddress.assertValid(a);
    this._nodes.add(a);
    return this;
  }

  removeNode(a: NodeAddressT): this {
    NodeAddress.assertValid(a);
    for (const e of this.edges()) {
      if (e.src === a || e.dst === a) {
        const srcOrDst = e.src === a ? "src" : "dst";
        throw new Error(
          `Attempted to remove ${srcOrDst} of ${edgeToString(e)}`
        );
      }
    }
    this._nodes.delete(a);
    return this;
  }

  hasNode(a: NodeAddressT): boolean {
    NodeAddress.assertValid(a);
    return this._nodes.has(a);
  }

  *nodes(): Iterator<NodeAddressT> {
    yield* this._nodes;
  }

  addEdge(edge: Edge): this {
    NodeAddress.assertValid(edge.src, "edge.src");
    NodeAddress.assertValid(edge.dst, "edge.dst");
    EdgeAddress.assertValid(edge.address, "edge.address");

    const srcMissing = !this._nodes.has(edge.src);
    const dstMissing = !this._nodes.has(edge.dst);
    if (srcMissing || dstMissing) {
      const missingThing = srcMissing ? "src" : "dst";
      throw new Error(`Missing ${missingThing} on edge: ${edgeToString(edge)}`);
    }
    const existingEdge = this._edges.get(edge.address);
    if (existingEdge != null) {
      if (
        existingEdge.src !== edge.src ||
        existingEdge.dst !== edge.dst ||
        existingEdge.address !== edge.address
      ) {
        const strEdge = edgeToString(edge);
        const strExisting = edgeToString(existingEdge);
        throw new Error(
          `conflict between new edge ${strEdge} and existing ${strExisting}`
        );
      }
    }
    this._edges.set(edge.address, edge);
    return this;
  }

  removeEdge(address: EdgeAddressT): this {
    EdgeAddress.assertValid(address);
    this._edges.delete(address);
    return this;
  }

  hasEdge(address: EdgeAddressT): boolean {
    EdgeAddress.assertValid(address);
    return this._edges.has(address);
  }

  edge(address: EdgeAddressT): ?Edge {
    EdgeAddress.assertValid(address);
    return this._edges.get(address);
  }

  *edges(): Iterator<Edge> {
    yield* this._edges.values();
  }

  neighbors(node: NodeAddressT, options: NeighborsOptions): Iterator<Neighbor> {
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

export function edgeToString(edge: Edge): string {
  const address = EdgeAddress.toString(edge.address);
  const src = NodeAddress.toString(edge.src);
  const dst = NodeAddress.toString(edge.dst);
  return `{address: ${address}, src: ${src}, dst: ${dst}}`;
}
