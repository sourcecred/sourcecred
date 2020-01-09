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

export class Weights {
  nodeTypeWeights: Map<NodeAddressT, NodeWeight>;
  edgeTypeWeights: Map<EdgeAddressT, EdgeWeight>;
  nodeManualWeights: Map<NodeAddressT, NodeWeight>;

  constructor() {
    this.nodeTypeWeights = new Map();
    this.edgeTypeWeights = new Map();
    this.nodeManualWeights = new Map();
  }

  /**
   * Create an independent copy of the Weights.
   *
   * Mutating the copy will not affect the original.
   */
  copy(): Weights {
    const result = new Weights();
    result.nodeTypeWeights = new Map(this.nodeTypeWeights);
    result.edgeTypeWeights = new Map(this.edgeTypeWeights);
    result.nodeManualWeights = new Map(this.nodeManualWeights);
    return result;
  }

  toJSON(): WeightsJSON {
    return toCompat(COMPAT_INFO, {
      nodeTypeWeights: MapUtil.toObject(this.nodeTypeWeights),
      edgeTypeWeights: MapUtil.toObject(this.edgeTypeWeights),
      nodeManualWeights: MapUtil.toObject(this.nodeManualWeights),
    });
  }
  static fromJSON(json: WeightsJSON): Weights {
    const {nodeTypeWeights, edgeTypeWeights, nodeManualWeights} = fromCompat(
      COMPAT_INFO,
      json
    );
    const w = new Weights();
    w.nodeTypeWeights = MapUtil.fromObject(nodeTypeWeights);
    w.edgeTypeWeights = MapUtil.fromObject(edgeTypeWeights);
    w.nodeManualWeights = MapUtil.fromObject(nodeManualWeights);
    return w;
  }
}

export type WeightsJSON = Compatible<{|
  +nodeTypeWeights: {[NodeAddressT]: NodeWeight},
  +edgeTypeWeights: {[EdgeAddressT]: EdgeWeight},
  +nodeManualWeights: {[NodeAddressT]: NodeWeight},
|}>;
const COMPAT_INFO = {type: "sourcecred/weights", version: "0.1.0"};
