// @flow

import deepEqual from "lodash.isequal";
import type {Address, Addressable, AddressMapJSON} from "./address";
import {AddressMap} from "./address";

export type Node<T> = {|
  +address: Address,
  +payload: T,
|};

export type Edge<T> = {|
  +address: Address,
  +src: Address,
  +dst: Address,
  +payload: T,
|};

export type GraphJSON = {|
  +nodes: AddressMapJSON<Node<any>>,
  +edges: AddressMapJSON<Edge<any>>,
|};

export class Graph {
  _nodes: AddressMap<Node<any>>;
  _edges: AddressMap<Edge<any>>;

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

  equals(that: Graph): boolean {
    return this._nodes.equals(that._nodes) && this._edges.equals(that._edges);
  }

  toJSON(): GraphJSON {
    return {
      nodes: this._nodes.toJSON(),
      edges: this._edges.toJSON(),
    };
  }

  static fromJSON(json: GraphJSON): Graph {
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

  addNode(node: Node<any>) {
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

  addEdge(edge: Edge<any>) {
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

  getNode(address: Address): Node<mixed> {
    return this._nodes.get(address);
  }

  getEdge(address: Address): Edge<mixed> {
    return this._edges.get(address);
  }

  /**
   * Gets the array of all out-edges from the node at the given address.
   * The order of the resulting array is unspecified.
   */
  getOutEdges(nodeAddress: Address): Edge<mixed>[] {
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
  getInEdges(nodeAddress: Address): Edge<mixed>[] {
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
  getAllNodes(): Node<mixed>[] {
    return this._nodes.getAll();
  }

  /**
   * Gets all edges in the graph, in unspecified order.
   */
  getAllEdges(): Edge<mixed>[] {
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
  static merge(
    g1: Graph,
    g2: Graph,
    nodeResolver: (Node<mixed>, Node<mixed>) => Node<mixed>,
    edgeResolver: (Edge<mixed>, Edge<mixed>) => Edge<mixed>
  ) {
    const result = new Graph();
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
  static mergeConservative(g1: Graph, g2: Graph) {
    function conservativeReducer<T: Addressable>(
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
    return Graph.merge(
      g1,
      g2,
      (u, v) => conservativeReducer("nodes", u, v),
      (e, f) => conservativeReducer("edges", e, f)
    );
  }
}
