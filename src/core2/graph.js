// @flow

import deepEqual from "lodash.isequal";
import type {Address} from "./address";
import {AddressMap} from "./address";
import type {Compatible} from "../util/compat";
import stringify from "json-stable-stringify";

export type Node<NR: NodeReference, NP: NodePayload> = {|
  +ref: NR,
  +payload: NP,
  +address: Address,
|};

export interface NodePayload {
  address(): Address;

  /**
   * Convert this object to its serialized form. This must be a plain
   * old JSON value: i.e., a value `v` such that
   * `JSON.parse(JSON.stringify(v))` is deep-equal to `v`.
   */
  toJSON(): any;
}

export interface NodeReference {
  graph(): Graph;
  address(): Address;
  get(): ?Node<any, any>;

  neighbors(
    options?: NeighborsOptions
  ): Iterator<{|+ref: NodeReference, +edge: Edge<any>|}>;
}

export type Edge<+T> = {|
  +address: Address,
  +src: Address,
  +dst: Address,
  +payload: T,
|};

export type PluginFilter = {|+plugin: string, +type?: string|};
function addressFilterer(options?: PluginFilter) {
  if (options == null) {
    return (_: Address) => true;
  }
  const {plugin, type} = options;
  if (plugin == null) {
    throw new Error("PluginFilters must filter by plugin");
  }
  return ({owner}: Address) =>
    owner.plugin === plugin && (type == null || owner.type === type);
}
export type NeighborsOptions = {|
  +node?: PluginFilter,
  +edge?: PluginFilter,
  +direction?: "IN" | "OUT" | "ANY",
|};

export interface PluginHandler<NR: NodeReference, NP: NodePayload> {
  /**
   * Enrich a base reference with plugin-/domain-specific properties.
   */
  createReference(baseReference: NodeReference): NR;

  /**
   * Deserialize a JSON payload, which is guaranteed to be the
   * serialization of a previous `NP`.
   */
  createPayload(json: any): NP;

  /**
   * Provide the name of the plugin.
   * Should return a constant string.
   */
  pluginName(): string;
}

export type Plugins = $ReadOnlyArray<PluginHandler<any, any>>;

type MaybeNode = {|+address: Address, +node: Node<any, any> | void|};
type Integer = number;

type IndexedEdge = {|
  +address: Address,
  +srcIndex: Integer,
  +dstIndex: Integer,
  +payload: any,
|};

export class Graph {
  _plugins: Plugins;
  _pluginMap: PluginMap;

  // Invariant: sizes of `_nodeIndices`, `_nodes`, `_outEdges`, and
  // `_inEdges` are all equal.
  _nodes: MaybeNode[];
  _nodeIndices: AddressMap<{|+address: Address, +index: Integer|}>;

  // If `idx` is the index of a node `v`, then `_outEdges[idx]` is the
  // list of `e.address` for all edges `e` whose source is `v`.
  // Likewise, `_inEdges[idx]` has the addresses of all in-edges to `v`.
  _outEdges: Address[][];
  _inEdges: Address[][];
  _edges: AddressMap<IndexedEdge>;

  constructor(plugins: Plugins) {
    this._plugins = plugins.slice();
    this._pluginMap = createPluginMap(this._plugins);
    this._nodes = [];
    this._nodeIndices = new AddressMap();
    this._outEdges = [];
    this._inEdges = [];
    this._edges = new AddressMap();
  }

  ref(address: Address): NodeReference {
    if (address == null) {
      throw new Error(`address is ${String(address)}`);
    }
    // If node has an index and is still present, return the existing ref
    const indexDatum = this._nodeIndices.get(address);
    if (indexDatum != null) {
      const node = this._nodes[indexDatum.index].node;
      if (node != null) {
        return node.ref;
      }
    }
    // Otherwise, create a "dummy ref" that isn't backed by a node.
    const handler = findHandler(this._pluginMap, address.owner.plugin);
    return handler.createReference(new InternalReference(this, address));
  }

  node(address: Address): ?Node<any, any> {
    return this.ref(address).get();
  }

  /**
   * Get nodes in the graph, in unspecified order.
   *
   * If filter is provided, it will return only nodes with the requested plugin name
   * (and, optionally, type).
   */
  *nodes(options?: PluginFilter): Iterator<Node<any, any>> {
    const filter = addressFilterer(options);
    for (const maybeNode of this._nodes) {
      const node = maybeNode.node;
      if (node == null) {
        continue;
      }
      if (!filter(node.address)) {
        continue;
      }
      yield node;
    }
  }

  edge(address: Address): ?Edge<any> {
    const indexedEdge = this._edges.get(address);
    if (!indexedEdge) {
      return undefined;
    }
    return this._upgradeIndexedEdge(indexedEdge);
  }

  _upgradeIndexedEdge(indexedEdge: IndexedEdge): Edge<any> {
    return {
      address: indexedEdge.address,
      src: this._nodes[indexedEdge.srcIndex].address,
      dst: this._nodes[indexedEdge.dstIndex].address,
      payload: indexedEdge.payload,
    };
  }

  /**
   * Gets edges in the graph, in unspecified order.
   *
   * If filter is provided, it will return only edges with the requested type.
   */
  *edges(options?: PluginFilter): Iterator<Edge<any>> {
    let edges = this._edges
      .getAll()
      .map((indexedEdge) => this._upgradeIndexedEdge(indexedEdge));
    const filter = addressFilterer(options);
    for (const edge of edges) {
      if (filter(edge.address)) {
        yield edge;
      }
    }
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

  addNode(payload: NodePayload): this {
    if (payload == null) {
      throw new Error(`payload is ${String(payload)}`);
    }
    const address = payload.address();
    const index = this._addNodeAddress(address);
    const maybeNode = this._nodes[index];
    if (maybeNode.node !== undefined) {
      if (deepEqual(maybeNode.node.payload, payload)) {
        return this;
      } else {
        throw new Error(
          `node at address ${JSON.stringify(
            address
          )} exists with distinct contents`
        );
      }
    }
    const handler = findHandler(this._pluginMap, address.owner.plugin);
    const ref = handler.createReference(new InternalReference(this, address));
    const node = {ref, payload, address};
    this._nodes[index] = {address, node};
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
    if (edge.address == null) {
      throw new Error(`address is ${String(edge.address)}`);
    }
    if (edge.src == null) {
      throw new Error(`src is ${String(edge.src)}`);
    }
    if (edge.dst == null) {
      throw new Error(`dst is ${String(edge.dst)}`);
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

  /**
   * Merge a collection of graphs. If multiple graphs have a node with a
   * particular address, then the nodes must all have identical payload,
   * and a single copy of this node will be included in the result
   * graph; if not all nodes are identical, then an error is thrown.
   * Likewise, all edges at a particular address must have identical
   * source, destination, and payload.
   *
   * The existing graph objects are not modified.
   */
  static mergeConservative(
    plugins: Plugins,
    graphs: $ReadOnlyArray<Graph>
  ): Graph {
    const result = new Graph(plugins);
    graphs.forEach((graph) => {
      for (const node of graph.nodes()) {
        result.addNode(node.payload);
      }
      for (const edge of graph.edges()) {
        result.addEdge(edge);
      }
    });
    return result;
  }

  /**
   * Check the equality of two graphs. This verifies that the node and edge
   * contents are identical; it does not check which plugin handlers are
   * registered.
   */
  equals(that: Graph): boolean {
    const theseNodes = Array.from(this.nodes());
    const thoseNodes = Array.from(that.nodes());
    if (theseNodes.length !== thoseNodes.length) {
      return false;
    }

    const theseEdges = Array.from(this.edges());
    const thoseEdges = Array.from(that.edges());
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

  copy(): Graph {
    return Graph.mergeConservative(this.plugins(), [this]);
  }

  plugins(): Plugins {
    return this._plugins.slice();
  }

  static fromJSON(plugins: Plugins, json: Compatible<GraphJSON>): Graph {
    const _ = {plugins, json};
    throw new Error("Graphv2 is not yet implemented");
  }

  toJSON(): Compatible<GraphJSON> {
    throw new Error("Graphv2 is not yet implemented");
  }
}

export type GraphJSON = any;

type PluginMap = {[pluginName: string]: PluginHandler<any, any>};
function createPluginMap(plugins: Plugins): PluginMap {
  const pluginMap = {};
  plugins.forEach((p) => {
    const name = p.pluginName();
    if (pluginMap[name] != null) {
      throw new Error(`Duplicate plugin handler for "${name}"`);
    }
    pluginMap[name] = p;
  });
  return pluginMap;
}
function findHandler(pluginMap: PluginMap, pluginName: string) {
  if (pluginMap[pluginName] == null) {
    throw new Error(`No plugin handler for "${pluginName}"`);
  }
  return pluginMap[pluginName];
}

const DELEGATE_NODE_REFERENCE_BASE = Symbol("base");
function getBase(dnr: DelegateNodeReference): NodeReference {
  // Flow doesn't know about Symbols, so we use this function to
  // localize the `any`-casts as much as possible.
  return (dnr: any)[DELEGATE_NODE_REFERENCE_BASE];
}

export class DelegateNodeReference implements NodeReference {
  constructor(base: NodeReference) {
    (this: any)[DELEGATE_NODE_REFERENCE_BASE] = base;
  }
  graph() {
    return getBase(this).graph();
  }
  address() {
    return getBase(this).address();
  }
  get() {
    return getBase(this).get();
  }
  neighbors(options?: NeighborsOptions) {
    return getBase(this).neighbors(options);
  }
}

class InternalReference implements NodeReference {
  _graph: Graph;
  _address: Address;

  constructor(graph: Graph, address: Address) {
    this._graph = graph;
    this._address = address;
  }

  graph(): Graph {
    return this._graph;
  }
  address(): Address {
    return this._address;
  }
  get(): ?Node<any, any> {
    const indexDatum = this._graph._nodeIndices.get(this._address);
    if (indexDatum == null) {
      return undefined;
    }
    return this._graph._nodes[indexDatum.index].node;
  }

  *neighbors(
    options?: NeighborsOptions
  ): Iterator<{|+ref: NodeReference, +edge: Edge<any>|}> {
    const indexDatum = this._graph._nodeIndices.get(this._address);
    if (indexDatum == null) {
      return;
    }
    const nodeIndex = indexDatum.index;

    const direction = (options && options.direction) || "ANY";
    const edgeFilter =
      options == null ? (_) => true : addressFilterer(options.edge);
    const nodeFilter =
      options == null ? (_) => true : addressFilterer(options.node);

    const graph = this._graph;
    const adjacencies = [];
    if (direction === "ANY" || direction === "IN") {
      adjacencies.push({list: graph._inEdges[nodeIndex], direction: "IN"});
    }
    if (direction === "ANY" || direction === "OUT") {
      adjacencies.push({list: graph._outEdges[nodeIndex], direction: "OUT"});
    }

    for (const adjacency of adjacencies) {
      for (const edgeAddress of adjacency.list) {
        const indexedEdge = graph._edges.get(edgeAddress);
        if (indexedEdge == null) {
          throw new Error(
            `Edge at address ${stringify(edgeAddress)} does not exist`
          );
        }
        if (direction === "ANY" && adjacency.direction === "IN") {
          if (indexedEdge.srcIndex === indexedEdge.dstIndex) {
            continue;
          }
        }
        const edge = graph._upgradeIndexedEdge(indexedEdge);
        const ref = graph.ref(
          adjacency.direction === "IN" ? edge.src : edge.dst
        );
        if (edgeFilter(edge.address) && nodeFilter(ref.address())) {
          yield {edge, ref};
        }
      }
    }
  }
}
