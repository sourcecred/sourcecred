// @flow

import deepEqual from "lodash.isequal";
import type {Address, PluginType} from "./address";
import {AddressMap} from "./address";
import type {Compatible} from "../util/compat";

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

export class Graph {
  _plugins: Plugins;
  _pluginMap: PluginMap;
  _nodeIndices: AddressMap<{|+address: Address, +index: Integer|}>;
  _nodes: MaybeNode[];

  constructor(plugins: Plugins) {
    this._plugins = plugins.slice();
    this._pluginMap = createPluginMap(this._plugins);
    this._nodes = [];
    this._nodeIndices = new AddressMap();
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
  *nodes(filter?: PluginFilter): Iterator<Node<any, any>> {
    for (const maybeNode of this._nodes) {
      const node = maybeNode.node;
      if (node == null) {
        continue;
      }
      if (filter != null) {
        const owner = node.address.owner;
        if (owner.plugin !== filter.plugin) {
          continue;
        }
        if (filter.type != null && owner.type !== filter.type) {
          continue;
        }
      }
      yield node;
    }
  }

  edge(address: Address): Edge<any> {
    const _ = address;
    throw new Error("Graphv2 is not yet implemented");
  }

  /**
   * Gets edges in the graph, in unspecified order.
   *
   * If filter is provided, it will return only edges with the requested type.
   */
  edges(filter?: PluginType): Iterator<Edge<any>> {
    const _ = filter;
    throw new Error("Graphv2 is not yet implemented");
  }

  _addNodeAddress(address: Address): Integer {
    const indexDatum = this._nodeIndices.get(address);
    if (indexDatum != null) {
      return indexDatum.index;
    } else {
      const index = this._nodes.length;
      this._nodeIndices.add({address, index});
      this._nodes.push({address, node: undefined});
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
    const _ = edge;
    throw new Error("Graphv2 is not yet implemented");
  }

  removeEdge(address: Address): this {
    const _ = address;
    throw new Error("Graphv2 is not yet implemented");
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
    const _ = {plugins, graphs};
    throw new Error("Graphv2 is not yet implemented");
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

    for (const node of theseNodes) {
      if (!deepEqual(node, that.node(node.address))) {
        return false;
      }
    }
    return true;
  }

  copy(): Graph {
    throw new Error("Graphv2 is not yet implemented");
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

export class DelegateNodeReference implements NodeReference {
  // TODO(@wchargin): Use a Symbol here.
  __DelegateNodeReference_base: NodeReference;
  constructor(base: NodeReference) {
    this.__DelegateNodeReference_base = base;
  }
  graph() {
    return this.__DelegateNodeReference_base.graph();
  }
  address() {
    return this.__DelegateNodeReference_base.address();
  }
  get() {
    return this.__DelegateNodeReference_base.get();
  }
  neighbors(options?: NeighborsOptions) {
    return this.__DelegateNodeReference_base.neighbors(options);
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

  neighbors(
    options?: NeighborsOptions
  ): Iterator<{|+ref: NodeReference, +edge: Edge<any>|}> {
    const _ = options;
    throw new Error("Not implemented");
  }
}
