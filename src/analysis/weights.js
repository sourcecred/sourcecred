// @flow

import * as MapUtil from "../util/map";
import {type NodeAddressT, type EdgeAddressT} from "../core/graph";
import {toCompat, fromCompat, type Compatible} from "../util/compat";

/**
 * Represents the weight for a particular Node (or NodeType).
 * Weight 1 is the default value and signifies normal importance.
 * Weights are linear, so 2 is twice as important as 1.
 */
export type NodeWeight = number;

/**
 * Represents the forwards and backwards weights for a particular Edge (or
 * EdgeType).
 * Weight 1 is the default value and signifies normal importance.
 * Weights are linear, so 2 is twice as important as 1.
 */
export type EdgeWeight = {|+forwards: number, +backwards: number|};

/**
 * Represents the user-chosen weights for Node and Edge types, as well as for
 * individual nodes.
 *
 * Only user / project choices are stored here. If a weight is not present for
 * a particular type or node, then a default weight is used.
 */
export type Weights = {|
  // Maps from the NodeType's prefix to the weight.
  +nodeTypeWeights: Map<NodeAddressT, NodeWeight>,
  // Maps from the EdgeType's prefix to the weight.
  +edgeTypeWeights: Map<EdgeAddressT, EdgeWeight>,
  // Maps from the node's address to the weight.
  +nodeManualWeights: Map<NodeAddressT, NodeWeight>,
|};

/**
 * Creates default (i.e. empty) weights.
 *
 * When the weights are empty, defaults will be used for every type and node.
 */
export function defaultWeights(): Weights {
  return {
    nodeTypeWeights: new Map(),
    edgeTypeWeights: new Map(),
    nodeManualWeights: new Map(),
  };
}

export type WeightsJSON = Compatible<{|
  +nodeTypeWeights: {[NodeAddressT]: NodeWeight},
  +edgeTypeWeights: {[EdgeAddressT]: EdgeWeight},
  +nodeManualWeights: {[NodeAddressT]: NodeWeight},
|}>;
const COMPAT_INFO = {type: "sourcecred/weights", version: "0.1.0"};

export function toJSON(weights: Weights): WeightsJSON {
  return toCompat(COMPAT_INFO, {
    nodeTypeWeights: MapUtil.toObject(weights.nodeTypeWeights),
    edgeTypeWeights: MapUtil.toObject(weights.edgeTypeWeights),
    nodeManualWeights: MapUtil.toObject(weights.nodeManualWeights),
  });
}

export function fromJSON(json: WeightsJSON): Weights {
  const {nodeTypeWeights, edgeTypeWeights, nodeManualWeights} = fromCompat(
    COMPAT_INFO,
    json
  );
  return {
    nodeTypeWeights: MapUtil.fromObject(nodeTypeWeights),
    edgeTypeWeights: MapUtil.fromObject(edgeTypeWeights),
    nodeManualWeights: MapUtil.fromObject(nodeManualWeights),
  };
}
