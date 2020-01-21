// @flow

import * as MapUtil from "../util/map";
import {type NodeAddressT, type EdgeAddressT} from "../core/graph";
import {toCompat, fromCompat, type Compatible} from "../util/compat";

/**
 * Represents the weight for a particular Node (or node address prefix).
 * Weight 1 is the default value and signifies normal importance.
 * Weights are linear, so 2 is twice as important as 1.
 */
export type NodeWeight = number;

/**
 * Represents the forwards and backwards weights for a particular Edge (or
 * edge address prefix).
 * Weight 1 is the default value and signifies normal importance.
 * Weights are linear, so 2 is twice as important as 1.
 */
export type EdgeWeight = {|+forwards: number, +backwards: number|};

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

/**
 * Merge multiple Weights together.
 *
 * The resultant Weights will have every weight specified by each of the
 * input weights. If there are any overlaps (i.e. the same address is present
 * in two or more of the input weights), an error will be thrown. In the future,
 * we will likely modify this function to add a resolver that determines how to
 * combine multiple overlapping weights.
 */
export function merge(ws: $ReadOnlyArray<Weights>): Weights {
  const nodeWeights = MapUtil.merge(ws.map((x) => x.nodeWeights));
  const edgeWeights = MapUtil.merge(ws.map((x) => x.edgeWeights));
  return {nodeWeights, edgeWeights};
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
