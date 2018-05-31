// @flow

import type {Compatible} from "../util/compat";
import {toCompat, fromCompat} from "../util/compat";
import type {Address} from "./address";
import {AddressMap} from "./address";
import stringify from "json-stable-stringify";
import deepEqual from "lodash.isequal";

export type Node<NR: NodeReference, NP: NodePayload> = {|
  +ref: NR,
  +payload: NP,
  +address: Address,
|};

export interface NodePayload {
  /**
   * Convert this object to its serialized form. This must be a plain
   * old JSON value: i.e., a value `v` such that
   * `JSON.parse(JSON.stringify(v))` is deep-equal to `v`.
   */
  toJSON(): any;
  address(): Address;
}

export interface NodeReference {
  graph(): Graph;
  address(): Address;
  get(): ?Node<any, any>;

  neighbors(
    options?: NeighborsOptions
  ): Iterator<{|+ref: NodeReference, +edge: Edge|}>;
}

export interface Edge {
  /**
   * Convert this object to its serialized form. This must be a plain
   * old JSON value: i.e., a value `v` such that
   * `JSON.parse(JSON.stringify(v))` is deep-equal to `v`.
   * The `src` and `dst` should not be included in the JSON representation;
   * rather, the PluginHandler.createEdge method will be offered the src
   * and dst when regenerating the edge from JSON.
   */
  toJSON(): any;
  address(): Address;
  src(): NodeReference;
  dst(): NodeReference;
}

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

export interface PluginHandler<NR: NodeReference, NP: NodePayload, E: Edge> {
  /**
   * Enrich a base reference with plugin-/domain-specific properties.
   */
  createReference(baseReference: NodeReference): NR;

  /**
   * Deserialize a JSON node payload, which is guaranteed to be the
   * serialization of a previous `NP`.
   */
  createPayload(json: any): NP;

  /**
   * Deserialize a JSON edge payload, which is guaranteed to be the
   * seriaization of a previous `E`.
   */
  createEdge(src: NodeReference, dst: NodeReference, json: any): E;

  /**
   * Provide the name of the plugin.
   * Should return a constant string.
   */
  pluginName(): string;
}

export type Plugins = $ReadOnlyArray<PluginHandler<any, any, any>>;

type NodesSortedByStringifiedAddress = (
  | {|+address: Address|}
  | {|+payload: any, +pluginName: string|}
)[];
type EdgeJSON = {|
  payload: any,
  plugin: string,
  srcIndex: Integer,
  dstIndex: Integer,
|};
type EdgesSortedByStringifiedAddress = EdgeJSON[];
export type GraphJSON = {|
  +nodes: NodesSortedByStringifiedAddress,
  +edges: EdgesSortedByStringifiedAddress,
|};

const COMPAT_TYPE = "sourcecred/Graph";
const COMPAT_VERSION = "0.3.0";

type MaybeNode = {|+address: Address, +node: Node<any, any> | void|};
type Integer = number;
type AddressEdge = {|+address: Address, +edge: Edge|};

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
  _outEdges: Edge[][];
  _inEdges: Edge[][];
  _edges: AddressMap<AddressEdge>;

  constructor(plugins: Plugins): Graph {
    this._plugins = plugins.slice();
    this._pluginMap = createPluginMap(this._plugins);
    this._nodes = [];
    this._nodeIndices = new AddressMap();
    this._outEdges = [];
    this._inEdges = [];
    this._edges = new AddressMap();
    // Hack to avoid https://github.com/facebook/flow/issues/6400
    return this;
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

  edge(address: Address): ?Edge {
    const ea = this._edges.get(address);
    if (ea != null) {
      return ea.edge;
    }
  }

  /**
   * Gets edges in the graph, in unspecified order.
   *
   * If filter is provided, it will return only edges with the requested type.
   */
  *edges(options?: PluginFilter): Iterator<Edge> {
    const filter = addressFilterer(options);
    for (const {edge, address} of this._edges.getAll()) {
      if (filter(address)) {
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

  addEdge(edge: Edge): this {
    if (edge == null) {
      throw new Error(`edge is ${String(edge)}`);
    }
    const address = edge.address();
    if (address == null) {
      throw new Error(`address is ${String(address)}`);
    }
    const src = edge.src();
    if (src == null) {
      throw new Error(`src is ${String(src)}`);
    }
    const dst = edge.dst();
    if (dst == null) {
      throw new Error(`dst is ${String(dst)}`);
    }
    const existingEdge = this._edges.get(address);
    if (existingEdge != null) {
      if (!deepEqual(existingEdge.edge.toJSON(), edge.toJSON())) {
        throw new Error(
          `Edge at address ${stringify(address)} exists with distinct contents`
        );
      }
      const srcAddress = src.address();
      const existingSrcAddress = existingEdge.edge.src().address();
      if (!deepEqual(srcAddress, existingSrcAddress)) {
        throw new Error(
          `Edge at address ${stringify(address)} exists with distinct src`
        );
      }
      const dstAddress = dst.address();
      const existingDstAddress = existingEdge.edge.dst().address();
      if (!deepEqual(dstAddress, existingDstAddress)) {
        throw new Error(
          `Edge at address ${stringify(address)} exists with distinct dst`
        );
      }

      return this;
    }
    // It's possible we were passed refs from a different graph. We will create a new edge
    // with internal refs for consistency
    if (src.graph() !== this || dst.graph() !== this) {
      const edgeConstructor = findHandler(this._pluginMap, address.owner.plugin)
        .createEdge;
      edge = edgeConstructor(
        this.ref(src.address()),
        this.ref(dst.address()),
        edge.toJSON()
      );
    }
    // We make a redundant trip through the addressing layer; since
    // src and dst are both refs, we've likely already done this.
    // Potential perf optimization to internally expose the index directly.
    const srcIndex = this._addNodeAddress(edge.src().address());
    const dstIndex = this._addNodeAddress(edge.dst().address());

    this._edges.add({edge, address: edge.address()});
    this._outEdges[srcIndex].push(edge);
    this._inEdges[dstIndex].push(edge);
    return this;
  }

  removeEdge(address: Address): this {
    // TODO(perf): This is linear in the degree of the endpoints of the
    // edge. Consider storing in non-list form.
    const addressEdge = this._edges.get(address);
    if (addressEdge) {
      const edge = addressEdge.edge;
      this._edges.remove(address);
      // As above: Potential perf gain if get index w/o address translation
      const srcIndex = this._addNodeAddress(edge.src().address());
      const dstIndex = this._addNodeAddress(edge.dst().address());
      [this._outEdges[srcIndex], this._inEdges[dstIndex]].forEach((edges) => {
        const index = edges.findIndex((edge_) =>
          deepEqual(edge_.address(), address)
        );
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

    for (const thisNode of theseNodes) {
      const thatNode = that.node(thisNode.address);
      if (thatNode == null) {
        return false;
      }
      if (!deepEqual(thisNode.payload.toJSON(), thatNode.payload.toJSON())) {
        return false;
      }
    }
    for (const thisEdge of theseEdges) {
      const thatEdge = that.edge(thisEdge.address());
      if (thatEdge == null) {
        return false;
      }
      if (!deepEqual(thisEdge.src().address(), thatEdge.src().address())) {
        return false;
      }
      if (!deepEqual(thisEdge.dst().address(), thatEdge.dst().address())) {
        return false;
      }
      if (!deepEqual(thisEdge.toJSON(), thatEdge.toJSON())) {
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
    const compatJson: GraphJSON = fromCompat(
      {type: COMPAT_TYPE, version: COMPAT_VERSION},
      json
    );
    const result = new Graph(plugins);
    const pluginMap = createPluginMap(plugins);
    compatJson.nodes.forEach((rawPartialNode) => {
      if ("address" in rawPartialNode) {
        const partialNode: {|+address: Address|} = (rawPartialNode: any);
        result._addNodeAddress(partialNode.address);
      } else {
        const partialNode: {|
          +payload: any,
          +pluginName: string,
        |} = (rawPartialNode: any);
        const pluginName: string = partialNode.pluginName;
        const payload = findHandler(pluginMap, pluginName).createPayload(
          partialNode.payload
        );
        result.addNode(payload);
      }
    });
    function indexToRef(i: Integer): NodeReference {
      if (i >= result._nodes.length) {
        throw new Error(
          `indexToRef out of bounds: ${i}/${result._nodes.length}`
        );
      }
      return result.ref(result._nodes[i].address);
    }
    compatJson.edges.forEach((edgeJSON) => {
      const plugin = edgeJSON.plugin;
      const srcRef = indexToRef(edgeJSON.srcIndex);
      const dstRef = indexToRef(edgeJSON.dstIndex);
      const edge = findHandler(pluginMap, plugin).createEdge(
        srcRef,
        dstRef,
        edgeJSON.payload
      );
      result.addEdge(edge);
    });
    return result;
  }

  toJSON(): Compatible<GraphJSON> {
    const partialNodes: {|
      key: string,
      oldIndex: Integer,
      data:
        | {|+address: Address|}
        | {|+payload: NodePayload, +pluginName: string|},
    |}[] = this._nodes
      .map((maybeNode, oldIndex) => {
        const key = stringify(maybeNode.address);
        if (maybeNode.node != null) {
          const payload: NodePayload = maybeNode.node.payload;
          const data = {
            payload: payload.toJSON(),
            pluginName: payload.address().owner.plugin,
          };
          return {key, oldIndex, data};
        } else {
          const data = {address: maybeNode.address};
          return {key, oldIndex, data};
        }
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
    function keyCompare(a, b) {
      const ka = a.key;
      const kb = b.key;
      return ka < kb ? -1 : ka > kb ? +1 : 0;
    }
    partialNodes.sort(keyCompare);

    // Let `v` be a node that appears at index `i` in the internal
    // representation of this graph. If `v` appears at index `j` of the
    // output, then the following array `arr` has `arr[i] = j`.
    // Otherwise, `v` is a phantom node. In this case, `arr[i]` is not
    // defined and should not be accessed.
    const oldIndexToNewIndex = new Uint32Array(this._nodes.length);
    partialNodes.forEach(({oldIndex}, newIndex) => {
      oldIndexToNewIndex[oldIndex] = newIndex;
    });
    const sortedEdges = this._edges
      .getAll()
      .map((e) => ({edge: e.edge, key: stringify(e.address)}))
      .sort(keyCompare)
      .map(({edge}) => edge);

    const sortedEdgeJSON: EdgesSortedByStringifiedAddress = sortedEdges.map(
      (e: Edge) => {
        const oldSrcIndex = this._nodeIndices.get(e.src().address()).index;
        const oldDstIndex = this._nodeIndices.get(e.dst().address()).index;
        const srcIndex = oldIndexToNewIndex[oldSrcIndex];
        const dstIndex = oldIndexToNewIndex[oldDstIndex];
        return {
          payload: e.toJSON(),
          srcIndex,
          dstIndex,
          plugin: e.address().owner.plugin,
        };
      }
    );

    return toCompat(
      {type: COMPAT_TYPE, version: COMPAT_VERSION},
      {
        nodes: partialNodes.map((x) => x.data),
        edges: sortedEdgeJSON,
      }
    );
  }
}

type PluginMap = {[pluginName: string]: PluginHandler<any, any, any>};
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
  ): Iterator<{|+ref: NodeReference, +edge: Edge|}> {
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
      for (const edge of adjacency.list) {
        if (direction === "ANY" && adjacency.direction === "IN") {
          // Another perf win if we can internally poke thru to node ref index
          if (deepEqual(edge.src().address(), edge.dst().address())) {
            continue;
          }
        }
        const ref = adjacency.direction === "IN" ? edge.src() : edge.dst();
        if (edgeFilter(edge.address()) && nodeFilter(ref.address())) {
          yield {edge, ref};
        }
      }
    }
  }
}
