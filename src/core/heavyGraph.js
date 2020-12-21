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

/**
 * An entry in the array returned by AddressModule.toParts()
 */
export type AddressPart = string;

/**
 * the core structure in the Node weight-resolution tree
 */
export type NodeWeightBranch = {
  +weight?: NodeWeight,
  +children: Map<AddressPart, NodeWeightBranch>,
};

/**
 * the core structure in the Edge weight-resolution tree
 */
export type EdgeWeightBranch = {
  +weight?: EdgeWeight,
  +children: Map<AddressPart, EdgeWeightBranch>,
};

/**
 * The HeavyGraph class is a replacement for the WeightedGraph type. This class
 * eliminates the need give every node and edge that exists a weight. Rather,
 * address prefixes can be assigned a weight and when a node or edge weight is
 * queried, the longest prefix with a weight assigned will have its value
 * returned.
 *
 * Over the longer-term, WeightedGraph should be
 * refactored out of existence HeavyGraph should completely replace it.
 */
export class HeavyGraph {
  _nodeWeights: NodeWeightBranch;
  _edgeWeights: EdgeWeightBranch;
  graph: Graph;

  /**
   * Set the weight for a given "class" of nodes. Each node that contains the
   * supplied prefix in its address will potentially return this weight if no
   * weight is assigned for a larger prefix that the node's address contains.
   */
  setNodePrefixWeight(
    _unused_prefix: NodeAddressT,
    _unused_w: NodeWeight
  ): this {
    throw new Error("method not implemented");
  }

  /**
   * Set the weights for a given "class" of edges. Each edge that contains the
   * supplied prefix in its address will potentially return these weights if
   * none are assigned for a larger prefix that the edge's address contains.
   */
  setEdgePrefixWeight(
    _unused_prefix: EdgeAddressT,
    _unused_w: NodeWeight
  ): this {
    throw new Error("method not implemented");
  }

  /**
   * Add a node and optionally assign its weight. If a prefix of the node's
   * address doesn't have a weight assigned, a weight must be included or an
   * error will throw.
   */
  addNode(_unused_n: Node, _unused_w?: NodeWeight): this {
    throw new Error("method not implemented");
  }

  /**
   * Add an edge and optionally assign its weight. If a prefix of the edge's
   * address doesn't have a weight assigned, a weight must be included or an
   * error will throw.
   */
  addEdge(_unused_e: Edge, _unused_w?: EdgeWeight): this {
    throw new Error("method not implemented");
  }

  /**
   * Return the weight of the node, or the weight of the longest prefix of the
   * node address if the node doesn't have its own weight.
   */
  getNodeWeight(_unused_a: NodeAddressT): NodeWeight {
    throw new Error("method not implemented");
  }

  /**
   * Return the weights of the edge, or the weights of the longest prefix of the
   * edge address if the edge doesn't have its own weight.
   */
  getEdgeWeight(_unused_a: EdgeAddressT): EdgeWeight {
    throw new Error("method not implemented");
  }

  // Utilities

  merge(_unused_hg: HeavyGraph): HeavyGraph {
    throw new Error("method not implemented");
  }

  compareWeights(_unused_hg: HeavyGraph): WeightsComparison {
    throw new Error("method not implemented");
  }

  // TODO: add JSON serialization and deserialization helpers
  // TODO: Add a tagging system so nodes and edges can have their weights
  // programmatically shifted
}
