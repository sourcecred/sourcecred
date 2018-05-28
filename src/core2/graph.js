// @flow

import type {Address} from "./address";
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

export type NeighborsOptions = {|
  +nodeType?: string,
  +edgeType?: string,
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

export class Graph {
  _plugins: Plugins;

  constructor(plugins: Plugins) {
    this._plugins = plugins.slice();
  }

  ref(address: Address): NodeReference {
    const _ = address;
    throw new Error("Graphv2 is not yet implemented");
  }

  node(address: Address): ?Node<any, any> {
    const _ = address;
    throw new Error("Graphv2 is not yet implemented");
  }

  /**
   * Get nodes in the graph, in unspecified order.
   *
   * If filter is provided, it will return only nodes with the requested type.
   */
  nodes(filter?: {|+type?: string|}): Iterator<Node<any, any>> {
    const _ = filter;
    throw new Error("Graphv2 is not yet implemented");
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
  edges(filter?: {|+type?: string|}): Iterator<Edge<any>> {
    const _ = filter;
    throw new Error("Graphv2 is not yet implemented");
  }

  addNode(payload: NodePayload): this {
    const _ = payload;
    throw new Error("Graphv2 is not yet implemented");
  }

  removeNode(address: Address): this {
    const _ = address;
    throw new Error("Graphv2 is not yet implemented");
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

  equals(that: Graph): boolean {
    const _ = that;
    throw new Error("Graphv2 is not yet implemented");
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
