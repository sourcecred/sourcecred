// @flow

import deepEqual from "lodash.isequal";
import stringify from "json-stable-stringify";
import type {Address, Addressable, AddressMapJSON} from "./address";
import {AddressMap, toString as addressToString} from "./address";

export type Node<+T> = {|
  +address: Address,
  +payload: T,
|};

export type Edge<+T> = {|
  +address: Address,
  +src: Address,
  +dst: Address,
  +payload: T,
|};

export type GraphJSON<NP, EP> = {|
  +nodes: AddressMapJSON<Node<NP>>,
  +edges: AddressMapJSON<Edge<EP>>,
|};

export class Graph<NP, EP> {
  _nodes: AddressMap<Node<NP>>;
  _edges: AddressMap<Edge<EP>>;

  // The keyset of each of the following fields should equal the keyset
  // of `_nodes`. If `e` is an edge from `u` to `v`, then `e.address`
  // should appear exactly once in `_outEdges[u.address]` and exactly
  // once in `_inEdges[v.address]` (and every entry in `_inEdges` and
  // `_outEdges` should be of this form).
  _outEdges: AddressMap<{|+address: Address, +edges: Address[]|}>;
  _inEdges: AddressMap<{|+address: Address, +edges: Address[]|}>;

  constructor() {
    this._nodes = new AddressMap();
    this._edges = new AddressMap();
    this._outEdges = new AddressMap();
    this._inEdges = new AddressMap();
  }

  equals(that: Graph<NP, EP>): boolean {
    return this._nodes.equals(that._nodes) && this._edges.equals(that._edges);
  }

  toJSON(): GraphJSON<NP, EP> {
    return {
      nodes: this._nodes.toJSON(),
      edges: this._edges.toJSON(),
    };
  }

  static fromJSON<NP, EP>(json: GraphJSON<NP, EP>): Graph<NP, EP> {
    const result = new Graph();
    AddressMap.fromJSON(json.nodes)
      .getAll()
      .forEach((node) => {
        result.addNode(node);
      });
    AddressMap.fromJSON(json.edges)
      .getAll()
      .forEach((edge) => {
        result.addEdge(edge);
      });
    return result;
  }

  addNode(node: Node<NP>): Graph<NP, EP> {
    if (node == null) {
      throw new Error(`node is ${String(node)}`);
    }
    const existingNode = this.getNode(node.address);
    if (existingNode !== undefined) {
      if (deepEqual(existingNode, node)) {
        return this;
      } else {
        throw new Error(
          `node at address ${JSON.stringify(
            node.address
          )} exists with distinct contents`
        );
      }
    }
    this._nodes.add(node);
    this._outEdges.add({address: node.address, edges: []});
    this._inEdges.add({address: node.address, edges: []});
    return this;
  }

  addEdge(edge: Edge<EP>): Graph<NP, EP> {
    if (edge == null) {
      throw new Error(`edge is ${String(edge)}`);
    }
    const existingEdge = this.getEdge(edge.address);
    if (existingEdge !== undefined) {
      if (deepEqual(existingEdge, edge)) {
        return this;
      } else {
        throw new Error(
          `edge at address ${JSON.stringify(
            edge.address
          )} exists with distinct contents`
        );
      }
    }
    if (this.getNode(edge.src) === undefined) {
      throw new Error(`source ${JSON.stringify(edge.src)} does not exist`);
    }
    if (this.getNode(edge.dst) === undefined) {
      throw new Error(`source ${JSON.stringify(edge.dst)} does not exist`);
    }
    this._edges.add(edge);
    this._outEdges.get(edge.src).edges.push(edge.address);
    this._inEdges.get(edge.dst).edges.push(edge.address);
    return this;
  }

  getNode(address: Address): Node<NP> {
    return this._nodes.get(address);
  }

  getEdge(address: Address): Edge<EP> {
    return this._edges.get(address);
  }

  /**
   * Gets the array of all out-edges from the node at the given address.
   * The order of the resulting array is unspecified.
   */
  getOutEdges(nodeAddress: Address): Edge<EP>[] {
    if (nodeAddress == null) {
      throw new Error(`address is ${String(nodeAddress)}`);
    }
    const result = this._outEdges.get(nodeAddress);
    if (result === undefined) {
      throw new Error(`no node for address ${JSON.stringify(nodeAddress)}`);
    }
    return result.edges.map((e) => this.getEdge(e));
  }

  /**
   * Gets the array of all in-edges to the node at the given address.
   * The order of the resulting array is unspecified.
   */
  getInEdges(nodeAddress: Address): Edge<EP>[] {
    if (nodeAddress == null) {
      throw new Error(`address is ${String(nodeAddress)}`);
    }
    const result = this._inEdges.get(nodeAddress);
    if (result === undefined) {
      throw new Error(`no node for address ${JSON.stringify(nodeAddress)}`);
    }
    return result.edges.map((e) => this.getEdge(e));
  }

  /**
   * Gets all nodes in the graph, in unspecified order.
   */
  getAllNodes(): Node<NP>[] {
    return this._nodes.getAll();
  }

  /**
   * Gets all edges in the graph, in unspecified order.
   */
  getAllEdges(): Edge<EP>[] {
    return this._edges.getAll();
  }

  /**
   * Merge two graphs. When two nodes have the same address, a resolver
   * function will be called with the two nodes; the resolver should
   * return a new node with the same address, which will take the place
   * of the two nodes in the new graph. Edges have similar behavior.
   *
   * The existing graph objects are not modified.
   */
  static merge<NP, EP, N1: NP, E1: EP, N2: NP, E2: EP>(
    g1: Graph<N1, E1>,
    g2: Graph<N2, E2>,
    nodeResolver: (Node<N1>, Node<N2>) => Node<NP>,
    edgeResolver: (Edge<E1>, Edge<E2>) => Edge<EP>
  ): Graph<NP, EP> {
    const result: Graph<NP, EP> = new Graph();
    g1.getAllNodes().forEach((node) => {
      if (g2.getNode(node.address) !== undefined) {
        const resolved = nodeResolver(node, g2.getNode(node.address));
        result.addNode(resolved);
      } else {
        result.addNode(node);
      }
    });
    g2.getAllNodes().forEach((node) => {
      if (result.getNode(node.address) === undefined) {
        result.addNode(node);
      }
    });
    g1.getAllEdges().forEach((edge) => {
      if (g2.getEdge(edge.address) !== undefined) {
        const resolved = edgeResolver(edge, g2.getEdge(edge.address));
        result.addEdge(resolved);
      } else {
        result.addEdge(edge);
      }
    });
    g2.getAllEdges().forEach((edge) => {
      if (result.getEdge(edge.address) === undefined) {
        result.addEdge(edge);
      }
    });
    return result;
  }

  /**
   * Merge two graphs, assuming that if `g1` and `g2` both have a node
   * with a given address, then the nodes are deep-equal (and the same
   * for edges). If this assumption does not hold, this function will
   * raise an error.
   */
  static mergeConservative<NP, EP, N1: NP, E1: EP, N2: NP, E2: EP>(
    g1: Graph<N1, E1>,
    g2: Graph<N2, E2>
  ): Graph<NP, EP> {
    function conservativeResolver<T: Addressable>(
      kinds: string /* used for an error message on mismatch */,
      a: T,
      b: T
    ): T {
      if (deepEqual(a, b)) {
        return a;
      } else {
        throw new Error(
          `distinct ${kinds} with address ${JSON.stringify(a.address)}`
        );
      }
    }
    const result: Graph<NP, EP> = Graph.merge(
      g1,
      g2,
      (u, v) => conservativeResolver("nodes", u, v),
      (e, f) => conservativeResolver("edges", e, f)
    );
    return result;
  }
}

export function edgeID(src: Address, dst: Address): string {
  return stringify([src, dst]);
}
