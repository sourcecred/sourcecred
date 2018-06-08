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

type ModificationCount = number;

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

  // Incremented each time that any change is made to the graph. Used to
  // check for comodification.
  _modificationCount: ModificationCount;

  constructor(): void {
    this._modificationCount = 0;
    this._nodes = new Set();
    this._edges = new Map();
    this._inEdges = new Map();
    this._outEdges = new Map();
  }

  _checkForComodification(since: ModificationCount) {
    // TODO(perf): Consider eliding this in production.
    const now = this._modificationCount;
    if (now === since) {
      return;
    }
    if (now > since) {
      throw new Error("Concurrent modification detected");
    }
    if (now < since) {
      throw new Error(
        "Invariant violation: expected modification count in the future"
      );
    }
  }

  _markModification() {
    // TODO(perf): Consider eliding this in production.
    if (this._modificationCount >= Number.MAX_SAFE_INTEGER) {
      throw new Error(
        `Graph cannot be modified more than ${this._modificationCount} times.`
      );
    }
    this._modificationCount++;
  }

  addNode(a: NodeAddressT): this {
    NodeAddress.assertValid(a);
    this._nodes.add(a);
    this._markModification();
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
    this._markModification();
    return this;
  }

  hasNode(a: NodeAddressT): boolean {
    NodeAddress.assertValid(a);
    return this._nodes.has(a);
  }

  nodes(): Iterator<NodeAddressT> {
    return this._nodesIterator(this._modificationCount);
  }

  *_nodesIterator(
    initialModificationCount: ModificationCount
  ): Iterator<NodeAddressT> {
    for (const node of this._nodes) {
      this._checkForComodification(initialModificationCount);
      yield node;
    }
    this._checkForComodification(initialModificationCount);
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
    this._markModification();
    return this;
  }

  removeEdge(address: EdgeAddressT): this {
    EdgeAddress.assertValid(address);
    this._edges.delete(address);
    this._markModification();
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

  edges(): Iterator<Edge> {
    return this._edgesIterator(this._modificationCount);
  }

  *_edgesIterator(initialModificationCount: ModificationCount): Iterator<Edge> {
    for (const edge of this._edges.values()) {
      this._checkForComodification(initialModificationCount);
      yield edge;
    }
    this._checkForComodification(initialModificationCount);
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
