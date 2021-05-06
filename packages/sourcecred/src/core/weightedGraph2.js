// @flow

import {
  type Edge,
  type Node,
  type EdgeAddressT,
  type NodeAddressT,
  Graph,
} from "./graph";
import {
  type NodeWeight,
  type EdgeWeight,
  type WeightsComparison,
} from "./weights";
import {NodeTrie, EdgeTrie} from "./trie";

/**
 * An entry in the array returned by AddressModule.toParts()
 */
export type AddressPart = string;

export type WeightedNode = {|
  +node: Node,
  +weight: NodeWeight,
|};

export type WeightedEdge = {|
  +edge: Edge,
  +weight: EdgeWeight,
|};

/**
 * The WeightedGraph2 class is a replacement for the WeightedGraph type. This class
 * eliminates the need give every node and edge that exists a weight. Rather,
 * address prefixes can be assigned a weight and when a node or edge weight is
 * queried, the product of matching weights along the address chain is returned.
 *
 * Over the longer-term, WeightedGraph should be refactored out of existence and
 * WeightedGraph2 should completely replace it.
 */
export class WeightedGraph2 {
  _nodeWeights: NodeTrie<NodeWeight>;
  _edgeWeights: EdgeTrie<EdgeWeight>;
  graph: Graph;

  /**
   * Set the weight for a node address prefix.
   */
  setNodePrefixWeight(
    _unused_prefix: NodeAddressT,
    _unused_w: NodeWeight
  ): this {
    throw new Error("method not implemented");
  }

  /**
   * Set the weights for an edge address prefix.
   */
  setEdgePrefixWeight(
    _unused_prefix: EdgeAddressT,
    _unused_w: NodeWeight
  ): this {
    throw new Error("method not implemented");
  }

  /**
   * Add a node and optionally assign its weight. If a weight is not passed in,
   * the weight will default to 1.
   */
  addNode(_unused_n: Node, _unused_w?: NodeWeight): this {
    throw new Error("method not implemented");
  }

  node(_unused_a: NodeAddressT): ?WeightedNode {
    throw new Error("method not implemented");
  }

  nodes(options?: {|+prefix: NodeAddressT|}): Iterator<WeightedNode> {
    const _ = options;
    throw new Error("method not implemented");
  }

  /**
   * Add an edge and optionally assign its weight. If a prefix of the edge's
   * address doesn't have a weight assigned, the weight will default to 1.
   */
  addEdge(_unused_e: Edge, _unused_w?: EdgeWeight): this {
    throw new Error("method not implemented");
  }

  edge(_unused_a: EdgeAddressT): ?WeightedEdge {
    throw new Error("method not implemented");
  }

  edges(options?: {|+prefix: EdgeAddressT|}): Iterator<WeightedEdge> {
    const _ = options;
    throw new Error("method not implemented");
  }

  /**
   * Return the weight of a Node address.
   */
  getNodeAddressWeight(_unused_a: NodeAddressT): NodeWeight {
    throw new Error("method not implemented");
  }

  /**
   * Return the weight of an Edge address.
   */
  getEdgeAddressWeight(_unused_a: EdgeAddressT): EdgeWeight {
    throw new Error("method not implemented");
  }

  // Utilities

  merge(_unused_wg: WeightedGraph2): WeightedGraph2 {
    throw new Error("method not implemented");
  }

  compareWeights(_unused_wg: WeightedGraph2): WeightsComparison {
    throw new Error("method not implemented");
  }

  // TODO: add JSON serialization and deserialization helpers
  // TODO: Add a tagging system so nodes and edges can have their weights
  // programmatically shifted
}
