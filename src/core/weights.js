// @flow

import * as MapUtil from "../util/map";
import {
  type NodeAddressT,
  type EdgeAddressT,
  NodeAddress,
  EdgeAddress,
} from "../core/graph";
import {toCompat, fromCompat, type Compatible} from "../util/compat";

/**
 * Represents the weight for a particular Node (or node address prefix).
 * Weight 1 is the default value and signifies normal importance.
 * Weights are linear, so 2 is twice as important as 1.
 */
export type NodeWeight = number;

export type NodeOperator = (NodeWeight, NodeWeight) => NodeWeight;

/**
 * Represents the forwards and backwards weights for a particular Edge (or
 * edge address prefix).
 * Weight 1 is the default value and signifies normal importance.
 * Weights are linear, so 2 is twice as important as 1.
 */
export type EdgeWeight = {|+forwards: number, +backwards: number|};

export type EdgeOperator = (EdgeWeight, EdgeWeight) => EdgeWeight;

/**
 * Represents the weights for nodes and edges.
 *
 * The weights are stored by address prefix, i.e. multiple weights may apply
 * to a given node or edge.
 */
export type Weights = {|
  nodeWeights: Map<NodeAddressT, NodeWeight>,
  // Map from an edge prefix or address to a weight
  edgeWeights: Map<EdgeAddressT, EdgeWeight>,
|};

/**
 * Creates new, empty weights.
 */
export function empty(): Weights {
  return {
    nodeWeights: new Map(),
    edgeWeights: new Map(),
  };
}

export function copy(w: Weights): Weights {
  return {
    nodeWeights: new Map(w.nodeWeights),
    edgeWeights: new Map(w.edgeWeights),
  };
}

/** Merge multiple Weights together.
 *
 * The resultant Weights will have every weight specified by each of the input
 * weights.
 *
 * When there are overlaps (i.e. the same address is present in two or more of
 * the Weights), then the appropriate resolver will be invoked to resolve the
 * conflict. The resolver takes two weights and combines them to return a new
 * weight.
 *
 * When no resolvers are explicitly provided, merge defaults to
 * conservative "error on conflict" resolvers.
 */
export function merge(
  ws: $ReadOnlyArray<Weights>,
  resolvers: ?{|+nodeResolver: NodeOperator, +edgeResolver: EdgeOperator|}
): Weights {
  if (resolvers == null) {
    const nodeResolver = (_unused_a, _unused_b) => {
      throw new Error(
        "node weight conflict detected, but no resolver specified"
      );
    };
    const edgeResolver = (_unused_a, _unused_b) => {
      throw new Error(
        "edge weight conflict detected, but no resolver specified"
      );
    };
    resolvers = {nodeResolver, edgeResolver};
  }
  const weights: Weights = empty();
  const {nodeWeights, edgeWeights} = weights;
  const {nodeResolver, edgeResolver} = resolvers;
  for (const w of ws) {
    for (const [addr, val] of w.nodeWeights.entries()) {
      const existing = nodeWeights.get(addr);
      if (existing == null) {
        nodeWeights.set(addr, val);
      } else {
        try {
          nodeWeights.set(addr, nodeResolver(existing, val));
        } catch (e) {
          throw new Error(`${e} when resolving ${NodeAddress.toString(addr)}`);
        }
      }
    }
    for (const [addr, val] of w.edgeWeights.entries()) {
      const existing = edgeWeights.get(addr);
      if (existing == null) {
        edgeWeights.set(addr, val);
      } else {
        try {
          edgeWeights.set(addr, edgeResolver(existing, val));
        } catch (e) {
          throw new Error(
            `Error ${e} when resolving ${EdgeAddress.toString(addr)}`
          );
        }
      }
    }
  }
  return weights;
}

export type WeightsJSON = Compatible<{|
  +nodeWeights: {[NodeAddressT]: NodeWeight},
  +edgeWeights: {[EdgeAddressT]: EdgeWeight},
|}>;

export function toJSON(weights: Weights): WeightsJSON {
  return toCompat(COMPAT_INFO, {
    nodeWeights: MapUtil.toObject(weights.nodeWeights),
    edgeWeights: MapUtil.toObject(weights.edgeWeights),
  });
}

export function fromJSON(json: Compatible<any>): Weights {
  const {nodeWeights, edgeWeights} = fromCompat(COMPAT_INFO, json);
  return {
    nodeWeights: MapUtil.fromObject(nodeWeights),
    edgeWeights: MapUtil.fromObject(edgeWeights),
  };
}
const COMPAT_INFO = {type: "sourcecred/weights", version: "0.2.0"};
