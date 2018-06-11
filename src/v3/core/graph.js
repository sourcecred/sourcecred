// @flow

import deepEqual from "lodash.isequal";

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
  // Invariant: For a node `n`, the following are equivalent:
  //  1. `n` is in the graph;
  //  2. `_inEdges.has(n)`;
  //  3. `_outEdges.has(n)`.
  //
  // Invariant: If an edge `e` is in the graph, then `e.src` and `e.dst`
  // are both in the graph.
  //
  // Invariant: For an edge `e`, if `e.dst` and `e.src` are in the
  // graph, the following are equivalent:
  //  1. `e` is in the graph;
  //  2. `_inEdges.get(e.dst)` contains `e`;
  //  3. `_inEdges.get(e.dst)` contains `e` exactly once;
  //  4. `_outEdges.get(e.src)` contains `e`;
  //  5. `_outEdges.get(e.src)` contains `e` exactly once.
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
    if (!this._nodes.has(a)) {
      this._nodes.add(a);
      this._inEdges.set(a, []);
      this._outEdges.set(a, []);
    }
    this._markModification();
    return this;
  }

  removeNode(a: NodeAddressT): this {
    NodeAddress.assertValid(a);
    const existingInEdges = this._inEdges.get(a) || [];
    const existingOutEdges = this._outEdges.get(a) || [];
    const existingEdges = existingInEdges.concat(existingOutEdges);
    if (existingEdges.length > 0) {
      const strAddress = NodeAddress.toString(a);
      const strExampleEdge = edgeToString(existingEdges[0]);
      throw new Error(
        `Attempted to remove ${strAddress}, which is incident to ${
          existingEdges.length
        } edge(s), e.g.: ${strExampleEdge}`
      );
    }
    this._inEdges.delete(a);
    this._outEdges.delete(a);
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
    } else {
      this._edges.set(edge.address, edge);
      const inEdges = this._inEdges.get(edge.dst);
      const outEdges = this._outEdges.get(edge.src);
      if (inEdges == null || outEdges == null) {
        throw new Error(`Invariant violation on edge ${edgeToString(edge)}`);
      }
      inEdges.push(edge);
      outEdges.push(edge);
    }
    this._edges.set(edge.address, edge);
    this._markModification();
    return this;
  }

  removeEdge(address: EdgeAddressT): this {
    EdgeAddress.assertValid(address);
    const edge = this._edges.get(address);
    if (edge != null) {
      this._edges.delete(address);
      const inEdges = this._inEdges.get(edge.dst);
      const outEdges = this._outEdges.get(edge.src);
      if (inEdges == null || outEdges == null) {
        throw new Error(`Invariant violation on ${edgeToString(edge)}`);
      }
      // TODO(perf): This is linear in the degree of the endpoints of the
      // edge. Consider storing in non-list form (e.g., `_inEdges` and
      // `_outEdges` could be `Map<NodeAddressT, Set<EdgeAddressT>>`).
      [inEdges, outEdges].forEach((edges) => {
        const index = edges.findIndex((edge) => edge.address === address);
        if (index === -1) {
          const strAddress = EdgeAddress.toString(address);
          throw new Error(
            `Invariant violation when removing edge@${strAddress}`
          );
        }
        edges.splice(index, 1);
      });
    }
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
    if (!this.hasNode(node)) {
      throw new Error(`Node does not exist: ${NodeAddress.toString(node)}`);
    }
    return this._neighbors(node, options, this._modificationCount);
  }

  *_neighbors(
    node: NodeAddressT,
    options: NeighborsOptions,
    initialModificationCount: ModificationCount
  ): Iterator<Neighbor> {
    const nodeFilter = (n) => NodeAddress.hasPrefix(n, options.nodePrefix);
    const edgeFilter = (e) => EdgeAddress.hasPrefix(e, options.edgePrefix);
    const direction = options.direction;
    const adjacencies: {edges: Edge[], direction: string}[] = [];
    if (direction === Direction.IN || direction === Direction.ANY) {
      const inEdges = this._inEdges.get(node);
      if (inEdges == null) {
        throw new Error(
          `Invariant violation: No inEdges for ${NodeAddress.toString(node)}`
        );
      }
      adjacencies.push({edges: inEdges, direction: "IN"});
    }
    if (direction === Direction.OUT || direction === Direction.ANY) {
      const outEdges = this._outEdges.get(node);
      if (outEdges == null) {
        throw new Error(
          `Invariant violation: No outEdges for ${NodeAddress.toString(node)}`
        );
      }
      adjacencies.push({edges: outEdges, direction: "OUT"});
    }

    for (const adjacency of adjacencies) {
      for (const edge of adjacency.edges) {
        if (direction === Direction.ANY && adjacency.direction === "IN") {
          if (edge.src === edge.dst) {
            continue; // don't yield loop edges twice.
          }
        }
        const neighborNode = adjacency.direction === "IN" ? edge.src : edge.dst;
        if (nodeFilter(neighborNode) && edgeFilter(edge.address)) {
          this._checkForComodification(initialModificationCount);
          yield {edge, node: neighborNode};
        }
      }
    }
    this._checkForComodification(initialModificationCount);
  }

  equals(that: Graph): boolean {
    if (!(that instanceof Graph)) {
      throw new Error(`Expected Graph, got ${String(that)}`);
    }
    return (
      deepEqual(this._nodes, that._nodes) && deepEqual(this._edges, that._edges)
    );
  }

  copy(): Graph {
    return Graph.merge([this]);
  }

  toJSON(): GraphJSON {
    throw new Error("toJSON");
  }

  static fromJSON(json: GraphJSON): Graph {
    const _ = json;
    throw new Error("fromJSON");
  }

  static merge(graphs: Iterable<Graph>): Graph {
    const result = new Graph();
    for (const graph of graphs) {
      for (const node of graph.nodes()) {
        result.addNode(node);
      }
      for (const edge of graph.edges()) {
        result.addEdge(edge);
      }
    }
    return result;
  }
}

export function edgeToString(edge: Edge): string {
  const address = EdgeAddress.toString(edge.address);
  const src = NodeAddress.toString(edge.src);
  const dst = NodeAddress.toString(edge.dst);
  return `{address: ${address}, src: ${src}, dst: ${dst}}`;
}
