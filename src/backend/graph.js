// @flow

import deepEqual from "lodash.isequal";

export type Address = {|
  +repositoryName: string,
  +pluginName: string,
  +id: string,
|};

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

export class Graph {
  _nodes: {[nodeAddress: string]: Node<mixed>};
  _edges: {[edgeAddress: string]: Edge<mixed>};

  // The keyset of each of the following fields should equal the keyset
  // of `_nodes`. If `e` is an edge from `u` to `v`, then `e.address`
  // should appear exactly once in `_outEdges[u.address]` and exactly
  // once in `_inEdges[v.address]` (and every entry in `_inEdges` and
  // `_outEdges` should be of this form).
  _outEdges: {[nodeAddress: string]: Address[]};
  _inEdges: {[nodeAddress: string]: Address[]};

  constructor() {
    this._nodes = {};
    this._edges = {};
    this._outEdges = {};
    this._inEdges = {};
  }

  equals(that: Graph): boolean {
    return (
      deepEqual(this._nodes, that._nodes) && deepEqual(this._edges, that._edges)
    );
  }

  addNode(node: Node<mixed>) {
    if (node == null) {
      throw new Error(`node is ${String(node)}`);
    }
    if (this.getNode(node.address) !== undefined) {
      throw new Error(
        `node at address ${JSON.stringify(node.address)} already exists`
      );
    }
    const addressString = addressToString(node.address);
    this._nodes[addressString] = node;
    this._outEdges[addressString] = [];
    this._inEdges[addressString] = [];
    return this;
  }

  addEdge(edge: Edge<mixed>) {
    if (edge == null) {
      throw new Error(`edge is ${String(edge)}`);
    }
    if (this.getEdge(edge.address) !== undefined) {
      throw new Error(
        `edge at address ${JSON.stringify(edge.address)} already exists`
      );
    }
    if (this.getNode(edge.src) === undefined) {
      throw new Error(`source ${JSON.stringify(edge.src)} does not exist`);
    }
    if (this.getNode(edge.dst) === undefined) {
      throw new Error(`source ${JSON.stringify(edge.dst)} does not exist`);
    }
    this._edges[addressToString(edge.address)] = edge;
    this._outEdges[addressToString(edge.src)].push(edge.address);
    this._inEdges[addressToString(edge.dst)].push(edge.address);
    return this;
  }

  getNode(address: Address): Node<mixed> {
    return this._nodes[addressToString(address)];
  }

  getEdge(address: Address): Edge<mixed> {
    return this._edges[addressToString(address)];
  }

  /**
   * Gets the array of all out-edges from the node at the given address.
   * The order of the resulting array is unspecified.
   */
  getOutEdges(nodeAddress: Address): Edge<mixed>[] {
    if (nodeAddress == null) {
      throw new Error(`address is ${String(nodeAddress)}`);
    }
    const addresses = this._outEdges[addressToString(nodeAddress)];
    if (addresses === undefined) {
      throw new Error(`no node for address ${JSON.stringify(nodeAddress)}`);
    }
    return addresses.map((e) => this.getEdge(e));
  }

  /**
   * Gets the array of all in-edges to the node at the given address.
   * The order of the resulting array is unspecified.
   */
  getInEdges(nodeAddress: Address): Edge<mixed>[] {
    if (nodeAddress == null) {
      throw new Error(`address is ${String(nodeAddress)}`);
    }
    const addresses = this._inEdges[addressToString(nodeAddress)];
    if (addresses === undefined) {
      throw new Error(`no node for address ${JSON.stringify(nodeAddress)}`);
    }
    return addresses.map((e) => this.getEdge(e));
  }

  /**
   * Gets all nodes in the graph, in unspecified order.
   */
  getAllNodes(): Node<mixed>[] {
    return Object.keys(this._nodes).map((k) => this._nodes[k]);
  }

  /**
   * Gets all edges in the graph, in unspecified order.
   */
  getAllEdges(): Edge<mixed>[] {
    return Object.keys(this._edges).map((k) => this._edges[k]);
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
    function conservativeReducer<T: {+address: Address}>(
      kinds: string /* used for an error message on mismatch */,
      a: T,
      b: T
    ): T {
      if (deepEqual(a, b)) {
        return a;
      } else {
        throw new Error(
          `distinct ${kinds} with address ${addressToString(a.address)}`
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

export function addressToString(address: Address) {
  if (address == null) {
    throw new Error(`address is ${String(address)}`);
  }
  if (address.repositoryName.includes("$")) {
    const escaped = JSON.stringify(address.repositoryName);
    throw new Error(`address.repositoryName must not include "\$": ${escaped}`);
  }
  if (address.pluginName.includes("$")) {
    const escaped = JSON.stringify(address.pluginName);
    throw new Error(`address.pluginName must not include "\$": ${escaped}`);
  }
  if (address.id.includes("$")) {
    const escaped = JSON.stringify(address.id);
    throw new Error(`address.id must not include "\$": ${escaped}`);
  }
  return `${address.repositoryName}\$${address.pluginName}\$${address.id}`;
}

export function stringToAddress(string: string) {
  if (string == null) {
    throw new Error(`address string is ${String(string)}`);
  }
  const parts = string.split("$");
  if (parts.length !== 3) {
    const escaped = JSON.stringify(string);
    throw new Error(`Input should have exactly two \$s: ${escaped}`);
  }
  return {
    repositoryName: parts[0],
    pluginName: parts[1],
    id: parts[2],
  };
}
