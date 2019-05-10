// @flow

/**
 * Core "model" logic for the Odyssey plugin.
 * Basically allows creating a data store of priorities, contributions, and people,
 * and compiling that data store into a cred Graph.
 */
import {
  Graph,
  EdgeAddress,
  NodeAddress,
  type NodeAddressT,
  type GraphJSON,
  sortedNodeAddressesFromJSON,
} from "../../core/graph";

import deepEqual from "lodash.isequal";

import {
  NODE_PREFIX,
  EDGE_PREFIX,
  type OdysseyNodeTypeIdentifier,
  isOdysseyNodeTypeIdentifier,
  type OdysseyEdgeTypeIdentifier,
  isOdysseyEdgeTypeIdentifier,
} from "./declaration";

import {toCompat, fromCompat, type Compatible} from "../../util/compat";

import * as NullUtil from "../../util/null";

export type Node = {|
  +nodeTypeIdentifier: OdysseyNodeTypeIdentifier,
  +address: NodeAddressT,
  +description: string,
|};

const COMPAT_INFO = {type: "sourcecred/odyssey/instance", version: "0.1.0"};
export type InstanceJSON = Compatible<{|
  +name: string,
  +graphJSON: GraphJSON,
  +sortedDescriptions: $ReadOnlyArray<string>,
  +count: number,
|}>;

/**
 * This is the data model for a particular instance in the Odyssey Plugin.
 * The OdysseyInstance allows adding "Entities", which are basically nodes
 * in the Odyssey graph augmented with a type identifier, and a description.
 * Currently, the types are restricted to types hard-coded in the
 * [declaration](./declaration.js) but we intend to allow instance-specified
 * types in the future.
 *
 * The OdysseyInstance maintains an internal graph which actually stores the
 * node identities, as well as added nodes. You can get a copy of this graph
 * by calling the `.graph()` method.
 *
 * Entities are identified by an incrementing id (`._count`). This is
 * convenient for implementation, although it will make reconciling
 * simultaneous edits challenging. Once that becomes a real issue, we should
 * switch to a different node/edge identification strategy.
 */
export class OdysseyInstance {
  _graph: Graph;
  _descriptions: Map<NodeAddressT, string>;
  _count: number;
  _name: string;

  /**
   * Construct an Odyssey Instance.
   */
  constructor(name: string) {
    this._name = name;
    this._graph = new Graph();
    this._descriptions = new Map();
    this._count = 0;
  }

  /**
   * Get the name of the instance.
   */
  name(): string {
    return this._name;
  }

  /**
   * Add a new node to the instance (and a corresponding node to the graph).
   *
   * Requires a valid node type identifier (a string that uniquely identifies
   * an Odyssey node type; see [declaration.js](./declaration.js)).
   */
  addNode(
    typeIdentifier: OdysseyNodeTypeIdentifier,
    description: string
  ): Node {
    if (!isOdysseyNodeTypeIdentifier(typeIdentifier)) {
      throw new Error(
        `Tried to add node with invalid type identifier: ${typeIdentifier}`
      );
    }
    const address = NodeAddress.append(
      NODE_PREFIX,
      typeIdentifier,
      String(this._count)
    );
    this._graph.addNode(address);
    this._count++;
    this._descriptions.set(address, description);
    return NullUtil.get(this.node(address));
  }

  /**
   * Retrieve the Node corresponding to a given node address, if it exists.
   */
  node(address: NodeAddressT): ?Node {
    if (!this._graph.hasNode(address)) {
      return null;
    }
    const parts = NodeAddress.toParts(address);
    // We know it is an OdysseyNodeTypeIdentifier because the instance's internal
    // graph only has Odyssey nodes in it.
    const nodeTypeIdentifier: OdysseyNodeTypeIdentifier = (parts[2]: any);
    if (!isOdysseyNodeTypeIdentifier(nodeTypeIdentifier)) {
      throw new Error(
        `Invariant violation: ${nodeTypeIdentifier} is not odyssey type identifier`
      );
    }
    const description = NullUtil.get(this._descriptions.get(address));
    return {address, nodeTypeIdentifier, description};
  }

  /**
   * Retrieve all the Nodes in the instance.
   *
   * Optionally filter to only nodes of a chosen type.
   */
  nodes(typeIdentifier?: OdysseyNodeTypeIdentifier): Iterator<Node> {
    const prefix =
      typeIdentifier == null
        ? NODE_PREFIX
        : NodeAddress.append(NODE_PREFIX, typeIdentifier);
    return this._nodesIterator(prefix);
  }

  *_nodesIterator(prefix: NodeAddressT): Iterator<Node> {
    for (const a of this._graph.nodes({prefix})) {
      yield NullUtil.get(this.node(a));
    }
  }

  /**
   * Add an edge to the Odyssey instance.
   */
  // TODO(@decentralion): Add support for edge types (also configured on a per-instance basis).
  addEdge(
    type: OdysseyEdgeTypeIdentifier,
    src: Node,
    dst: Node
  ): OdysseyInstance {
    if (!isOdysseyEdgeTypeIdentifier(type)) {
      throw new Error(`Invalid Odyssey edge type identifier: ${type}`);
    }
    const edge = {
      src: src.address,
      dst: dst.address,
      address: EdgeAddress.append(EDGE_PREFIX, type, String(this._count)),
    };
    this._graph.addEdge(edge);
    this._count++;
    return this;
  }

  /**
   * Returns a copy of the graph underlying this instance.
   */
  graph(): Graph {
    return this._graph.copy();
  }

  toJSON(): InstanceJSON {
    const graphJSON = this._graph.toJSON();
    const sortedNodeAddresses = sortedNodeAddressesFromJSON(graphJSON);
    const sortedDescriptions = sortedNodeAddresses.map((a) =>
      NullUtil.get(this._descriptions.get(a))
    );
    return toCompat(COMPAT_INFO, {
      name: this._name,
      graphJSON,
      sortedDescriptions,
      count: this._count,
    });
  }

  static fromJSON(j: InstanceJSON): OdysseyInstance {
    const {name, graphJSON, sortedDescriptions, count} = fromCompat(
      COMPAT_INFO,
      j
    );
    const instance = new OdysseyInstance(name);
    instance._graph = Graph.fromJSON(graphJSON);
    instance._count = count;
    const descriptions = new Map();
    const sortedNodeAddresses = sortedNodeAddressesFromJSON(graphJSON);
    for (let i = 0; i < sortedNodeAddresses.length; i++) {
      descriptions.set(sortedNodeAddresses[i], sortedDescriptions[i]);
    }
    instance._descriptions = descriptions;
    return instance;
  }

  /**
   * Returns whether two Odyssey instances have identical histories.
   *
   * Two instances are historically identical if they have the same ordered
   * sequence of node additions and deletions. This is because the address of
   * Nodes and Edges in the instance is determined by the order in which they
   * were added.
   *
   * For an illustration, consider the following case:
   * ```js
   * const i1 = new OdysseyInstance();
   * i1.addNode("PERSON", "me")
   * i1.addNode("PERSON", "you")
   *
   * const i2 = new OdysseyInstance();
   * i2.addNode("PERSON", "you")
   * i2.addNode("PERSON", "me")
   *
   * expect(i1.isHistoricallyIdentical(i2)).toBe(false);
   * ```
   */
  isHistoricallyIdentical(that: OdysseyInstance): boolean {
    return (
      this._count === that._count &&
      this._graph.equals(that._graph) &&
      deepEqual(this._descriptions, that._descriptions)
    );
  }
}
