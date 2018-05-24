// @flow

import deepEqual from "lodash.isequal";
import stringify from "json-stable-stringify";
import type {Address, Addressable, AddressMapJSON} from "./address";
import {AddressMap} from "./address";
import {toCompat, fromCompat} from "../util/compat";
import type {Compatible} from "../util/compat";

type Integer = number;

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

type IndexedEdge = {|
  +address: Address,
  +srcIndex: Integer,
  +dstIndex: Integer,
  +payload: any,
|};

const COMPAT_TYPE = "sourcecred/sourcecred/Graph";
const COMPAT_VERSION = "0.2.0";

type NodesSortedByStringifiedAddress = {|
  +address: Address,
  +payload?: any,
|}[];
export type GraphJSON = {|
  +nodes: NodesSortedByStringifiedAddress,
  +edges: AddressMapJSON<IndexedEdge>,
|};

type MaybeNode = {|+address: Address, +node: Node<any> | void|};

export class Graph {
  // Invariant: sizes of `_nodeIndices`, `_nodes`, `_outEdges`, and
  // `_inEdges` are all equal.
  _nodeIndices: AddressMap<{|+address: Address, +index: Integer|}>;
  _nodes: MaybeNode[];
  _edges: AddressMap<IndexedEdge>;

  // If `idx` is the index of a node `v`, then `_outEdges[idx]` is the
  // list of `e.address` for all edges `e` whose source is `v`.
  // Likewise, `_inEdges[idx]` has the addresses of all in-edges to `v`.
  _outEdges: Address[][];
  _inEdges: Address[][];

  constructor() {
    this._nodeIndices = new AddressMap();
    this._nodes = [];
    this._edges = new AddressMap();
    this._outEdges = [];
    this._inEdges = [];
  }

  copy(): Graph {
    return Graph.mergeConservative(new Graph(), this);
  }

  equals(that: Graph): boolean {
    const theseNodes = this.nodes();
    const thoseNodes = that.nodes();
    if (theseNodes.length !== thoseNodes.length) {
      return false;
    }

    const theseEdges = this.edges();
    const thoseEdges = that.edges();
    if (theseEdges.length !== thoseEdges.length) {
      return false;
    }

    for (const node of theseNodes) {
      if (!deepEqual(node, that.node(node.address))) {
        return false;
      }
    }
    for (const edge of theseEdges) {
      if (!deepEqual(edge, that.edge(edge.address))) {
        return false;
      }
    }
    return true;
  }

  toJSON(): Compatible<GraphJSON> {
    const partialNodes: {|
      key: string,
      oldIndex: Integer,
      data: {|
        +address: Address,
        +payload?: any,
      |},
    |}[] = this._nodes
      .map((maybeNode, oldIndex) => {
        const key = stringify(maybeNode.address);
        const data = maybeNode.node || {address: maybeNode.address};
        return {key, oldIndex, data};
      })
      .filter(({oldIndex: idx}) => {
        // Say that a node is a "phantom node" if its address appears in
        // the graph, but the node does not, and no edge in the graph is
        // incident to the node. (For instance, if `v` is any node, then
        // `new Graph().addNode(v).removeNode(v.address)` has `v` as a
        // phantom node.) The existence of phantom nodes is part of the
        // internal state but not the logical state, so we remove these
        // nodes before serializing the graph to ensure logical
        // canonicity.
        return (
          this._nodes[idx].node !== undefined ||
          this._outEdges[idx].length > 0 ||
          this._inEdges[idx].length > 0
        );
      });
    partialNodes.sort((a, b) => {
      const ka = a.key;
      const kb = b.key;
      return ka < kb ? -1 : ka > kb ? +1 : 0;
    });

    // Let `v` be a node that appears at index `i` in the internal
    // representation of this graph. If `v` appears at index `j` of the
    // output, then the following array `arr` has `arr[i] = j`.
    // Otherwise, `v` is a phantom node. In this case, `arr[i]` is not
    // defined and should not be accessed.
    const oldIndexToNewIndex = new Uint32Array(this._nodes.length);
    partialNodes.forEach(({oldIndex}, newIndex) => {
      oldIndexToNewIndex[oldIndex] = newIndex;
    });

    const edges = new AddressMap();
    this._edges.getAll().forEach((oldIndexedEdge) => {
      // Here, we know that the old edge's `srcIndex` and `dstIndex`
      // indices are in the domain of `oldIndexToNewIndex`, because the
      // corresponding nodes are not phantom, because `oldIndexedEdge`
      // is incident to them.
      const newIndexedEdge = {
        address: oldIndexedEdge.address,
        payload: oldIndexedEdge.payload,
        srcIndex: oldIndexToNewIndex[oldIndexedEdge.srcIndex],
        dstIndex: oldIndexToNewIndex[oldIndexedEdge.dstIndex],
      };
      edges.add(newIndexedEdge);
    });

    return toCompat(
      {type: COMPAT_TYPE, version: COMPAT_VERSION},
      {
        nodes: partialNodes.map((x) => x.data),
        edges: edges.toJSON(),
      }
    );
  }

  static fromJSON(json: Compatible<GraphJSON>): Graph {
    const compatJson: GraphJSON = fromCompat(
      {
        type: COMPAT_TYPE,
        version: COMPAT_VERSION,
      },
      json
    );
    const result = new Graph();
    compatJson.nodes.forEach((partialNode) => {
      if ("payload" in partialNode) {
        const node: Node<any> = (partialNode: any);
        result.addNode(node);
      } else {
        result._addNodeAddress(partialNode.address);
      }
    });
    AddressMap.fromJSON(compatJson.edges)
      .getAll()
      .forEach((indexedEdge) => {
        result._addIndexedEdge(indexedEdge);
      });
    return result;
  }

  _addNodeAddress(address: Address): Integer {
    const indexDatum = this._nodeIndices.get(address);
    if (indexDatum != null) {
      return indexDatum.index;
    } else {
      const index = this._nodes.length;
      this._nodeIndices.add({address, index});
      this._nodes.push({address, node: undefined});
      this._outEdges.push([]);
      this._inEdges.push([]);
      return index;
    }
  }

  addNode(node: Node<any>): this {
    if (node == null) {
      throw new Error(`node is ${String(node)}`);
    }
    const index = this._addNodeAddress(node.address);
    const maybeNode = this._nodes[index];
    if (maybeNode.node !== undefined) {
      if (deepEqual(maybeNode.node, node)) {
        return this;
      } else {
        throw new Error(
          `node at address ${JSON.stringify(
            node.address
          )} exists with distinct contents`
        );
      }
    }
    this._nodes[index] = {address: maybeNode.address, node};
    return this;
  }

  removeNode(address: Address): this {
    const indexDatum = this._nodeIndices.get(address);
    if (indexDatum != null) {
      this._nodes[indexDatum.index] = {address, node: undefined};
    }
    return this;
  }

  addEdge(edge: Edge<any>): this {
    if (edge == null) {
      throw new Error(`edge is ${String(edge)}`);
    }
    const srcIndex = this._addNodeAddress(edge.src);
    const dstIndex = this._addNodeAddress(edge.dst);
    const indexedEdge = {
      address: edge.address,
      srcIndex,
      dstIndex,
      payload: edge.payload,
    };
    return this._addIndexedEdge(indexedEdge);
  }

  _addIndexedEdge(indexedEdge: IndexedEdge): this {
    const existingIndexedEdge = this._edges.get(indexedEdge.address);
    if (existingIndexedEdge !== undefined) {
      if (deepEqual(existingIndexedEdge, indexedEdge)) {
        return this;
      } else {
        throw new Error(
          `edge at address ${JSON.stringify(
            indexedEdge.address
          )} exists with distinct contents`
        );
      }
    }
    this._edges.add(indexedEdge);
    this._outEdges[indexedEdge.srcIndex].push(indexedEdge.address);
    this._inEdges[indexedEdge.dstIndex].push(indexedEdge.address);
    return this;
  }

  removeEdge(address: Address): this {
    // TODO(perf): This is linear in the degree of the endpoints of the
    // edge. Consider storing in non-list form.
    const indexedEdge = this._edges.get(address);
    if (indexedEdge) {
      this._edges.remove(address);
      [
        this._outEdges[indexedEdge.srcIndex],
        this._inEdges[indexedEdge.dstIndex],
      ].forEach((edges) => {
        const index = edges.findIndex((ea) => deepEqual(ea, address));
        if (index !== -1) {
          edges.splice(index, 1);
        }
      });
    }
    return this;
  }

  node(address: Address): Node<any> {
    const indexDatum = this._nodeIndices.get(address);
    if (indexDatum == null) {
      // We've never heard of this node.
      return (undefined: any);
    } else {
      const node: Node<any> | void = this._nodes[indexDatum.index].node;
      return ((node: any): Node<any>);
    }
  }

  edge(address: Address): Edge<any> {
    const indexedEdge = this._edges.get(address);
    if (!indexedEdge) {
      // Lie.
      return (undefined: any);
    }
    return {
      address: indexedEdge.address,
      src: this._nodes[indexedEdge.srcIndex].address,
      dst: this._nodes[indexedEdge.dstIndex].address,
      payload: indexedEdge.payload,
    };
  }

  /**
   * Find the neighborhood of the node at the given address.
   *
   * By neighborhood, we mean every `{edge, neighbor}` such that edge
   * has `nodeAddress` as either `src` or `dst`, and `neighbor` is the
   * address at the other end of the edge.
   *
   * The returned neighbors are filtered according to the `options`. Callers
   * can filter by nodeType, edgeType, and whether it should be an "IN" edge
   * (i.e. the provided node is the dst), an "OUT" edge (i.e. provided node is
   * the src), or "ANY".
   */
  neighborhood(
    nodeAddress: Address,
    options?: {|
      +nodeType?: string,
      +edgeType?: string,
      +direction?: "IN" | "OUT" | "ANY",
    |}
  ): {|+edge: Edge<any>, +neighbor: Address|}[] {
    if (nodeAddress == null) {
      throw new Error(`address is ${String(nodeAddress)}`);
    }

    const indexDatum = this._nodeIndices.get(nodeAddress);
    if (indexDatum == null) {
      return [];
    }
    const nodeIndex = indexDatum.index;

    let result: {|+edge: Edge<any>, +neighbor: Address|}[] = [];
    const direction = (options != null && options.direction) || "ANY";

    if (direction === "ANY" || direction === "IN") {
      let inNeighbors = this._inEdges[nodeIndex].map((edgeAddress) => {
        const edge = this.edge(edgeAddress);
        return {edge, neighbor: edge.src};
      });
      result = result.concat(inNeighbors);
    }

    if (direction === "ANY" || direction === "OUT") {
      let outNeighbors = this._outEdges[nodeIndex].map((edgeAddress) => {
        const edge = this.edge(edgeAddress);
        return {edge, neighbor: edge.dst};
      });
      if (direction === "ANY") {
        // If direction is ANY, we already counted self-referencing edges as
        // an inNeighbor
        outNeighbors = outNeighbors.filter(
          ({edge}) => !deepEqual(edge.src, edge.dst)
        );
      }
      result = result.concat(outNeighbors);
    }

    if (options != null && options.edgeType != null) {
      const edgeType = options.edgeType;
      result = result.filter(({edge}) => edge.address.type === edgeType);
    }
    if (options != null && options.nodeType != null) {
      const nodeType = options.nodeType;
      result = result.filter(({neighbor}) => neighbor.type === nodeType);
    }
    return result;
  }

  /**
   * Get nodes in the graph, in unspecified order.
   *
   * If filter is provided, it will return only nodes with the requested type.
   */
  nodes(filter?: {type?: string}): Node<any>[] {
    /*:: declare function nonNulls<T>(x: (T | void)[]): T[]; */
    let nodes = this._nodes.map((x) => x.node).filter((x) => Boolean(x));
    /*:: nodes = nonNulls(nodes); */
    if (filter != null && filter.type != null) {
      const typeFilter = filter.type;
      nodes = nodes.filter((n) => n.address.type === typeFilter);
    }
    return nodes;
  }

  /**
   * Gets edges in the graph, in unspecified order.
   *
   * If filter is provided, it will return only edges with the requested type.
   */
  edges(filter?: {type?: string}): Edge<any>[] {
    let edges = this._edges.getAll().map((indexedEdge) => ({
      address: indexedEdge.address,
      src: this._nodes[indexedEdge.srcIndex].address,
      dst: this._nodes[indexedEdge.dstIndex].address,
      payload: indexedEdge.payload,
    }));
    if (filter != null && filter.type != null) {
      const typeFilter = filter.type;
      edges = edges.filter((e) => e.address.type === typeFilter);
    }
    return edges;
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
    nodeResolver: (Node<any>, Node<any>) => Node<any>,
    edgeResolver: (Edge<any>, Edge<any>) => Edge<any>
  ): Graph {
    const result: Graph = new Graph();
    g1.nodes().forEach((node) => {
      if (g2.node(node.address) !== undefined) {
        const resolved = nodeResolver(node, g2.node(node.address));
        result.addNode(resolved);
      } else {
        result.addNode(node);
      }
    });
    g2.nodes().forEach((node) => {
      if (result.node(node.address) === undefined) {
        result.addNode(node);
      }
    });
    g1.edges().forEach((edge) => {
      if (g2.edge(edge.address) !== undefined) {
        const resolved = edgeResolver(edge, g2.edge(edge.address));
        result.addEdge(resolved);
      } else {
        result.addEdge(edge);
      }
    });
    g2.edges().forEach((edge) => {
      if (result.edge(edge.address) === undefined) {
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
  static mergeConservative(g1: Graph, g2: Graph): Graph {
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
    const result: Graph = Graph.merge(
      g1,
      g2,
      (u, v) => conservativeResolver("nodes", u, v),
      (e, f) => conservativeResolver("edges", e, f)
    );
    return result;
  }

  /**
   * Equivalent to
   *
   *     graphs.reduce((g, h) => Graph.mergeConservative(g, h), new Graph()),
   *
   * but uses a mutable accumulator for improved performance.
   */
  static mergeManyConservative(graphs: $ReadOnlyArray<Graph>): Graph {
    const result = new Graph();
    graphs.forEach((graph) => {
      graph.nodes().forEach((node) => {
        result.addNode(node);
      });
      graph.edges().forEach((edge) => {
        result.addEdge(edge);
      });
    });
    return result;
  }
}

export function edgeID(src: Address, dst: Address): string {
  return stringify([src, dst]);
}
