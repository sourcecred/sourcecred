// @flow

import type {NodeAddress, EdgeAddress} from "./_address";
import * as Address from "./_address";

export type {NodeAddress, EdgeAddress} from "./_address";
Object.freeze(Address);
export {Address};

export type Edge = {|
  +address: EdgeAddress,
  +src: NodeAddress,
  +dst: NodeAddress,
|};

export type Neighbor = {|+node: NodeAddress, +edge: Edge|};

export opaque type DirectionT = Symbol;
export const Direction: {|+IN: DirectionT, +OUT: DirectionT|} = Object.freeze({
  IN: Symbol("IN"),
  OUT: Symbol("OUT"),
});

export type NeighborsOptions = {|
  +direction: ?DirectionT,
  +nodePrefix: ?NodeAddress,
  +edgePrefix: ?EdgeAddress,
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
  _nodes: Set<NodeAddress>;
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
    Address.assertNodeAddress(a);
    this._nodes.add(a);
    return this;
  }

  removeNode(a: NodeAddress): this {
    Address.assertNodeAddress(a);
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

  hasNode(a: NodeAddress): boolean {
    Address.assertNodeAddress(a);
    return this._nodes.has(a);
  }

  *nodes(): Iterator<NodeAddress> {
    yield* this._nodes;
  }

  addEdge(edge: Edge): this {
    Address.assertNodeAddress(edge.src, "edge.src");
    Address.assertNodeAddress(edge.dst, "edge.dst");
    Address.assertEdgeAddress(edge.address, "edge.address");

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

  removeEdge(address: EdgeAddress): this {
    Address.assertEdgeAddress(address);
    this._edges.delete(address);
    return this;
  }

  hasEdge(address: EdgeAddress): boolean {
    Address.assertEdgeAddress(address);
    return this._edges.has(address);
  }

  edge(address: EdgeAddress): ?Edge {
    Address.assertEdgeAddress(address);
    return this._edges.get(address);
  }

  *edges(): Iterator<Edge> {
    yield* this._edges.values();
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

export function edgeToString(edge: Edge): string {
  const address = Address.edgeToString(edge.address);
  const src = Address.nodeToString(edge.src);
  const dst = Address.nodeToString(edge.dst);
  return `{address: ${address}, src: ${src}, dst: ${dst}}`;
}
