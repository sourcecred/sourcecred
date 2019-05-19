// @flow

import * as MapUtil from "../util/map";
import {type NodeAddressT, type EdgeAddressT} from "../core/graph";
import type {EdgeType, NodeType} from "./types";
import type {PluginDeclaration} from "./pluginDeclaration";

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

export type WeightedNodeType = {|+type: NodeType, +weight: NodeWeight|};

export type WeightedEdgeType = {|
  +type: EdgeType,
  +weight: EdgeWeight,
|};

export type WeightedTypes = {|
  // Map from the weighted type's prefix to the type
  +nodes: Map<NodeAddressT, WeightedNodeType>,
  +edges: Map<EdgeAddressT, WeightedEdgeType>,
|};

export type ManualWeights = Map<NodeAddressT, number>;

export function defaultWeightedNodeType(type: NodeType): WeightedNodeType {
  return {
    type,
    weight: type.defaultWeight,
  };
}

export function defaultWeightedEdgeType(type: EdgeType): WeightedEdgeType {
  return {
    type,
    weight: type.defaultWeight,
  };
}

export function defaultWeightsForDeclaration(
  declaration: PluginDeclaration
): WeightedTypes {
  return {
    nodes: new Map(
      declaration.nodeTypes.map((x) => [x.prefix, defaultWeightedNodeType(x)])
    ),
    edges: new Map(
      declaration.edgeTypes.map((x) => [x.prefix, defaultWeightedEdgeType(x)])
    ),
  };
}

export function combineWeights(
  ws: $ReadOnlyArray<WeightedTypes>
): WeightedTypes {
  return {
    nodes: MapUtil.merge(ws.map((x) => x.nodes)),
    edges: MapUtil.merge(ws.map((x) => x.edges)),
  };
}
