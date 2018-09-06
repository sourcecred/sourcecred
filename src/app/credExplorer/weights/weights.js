// @flow

import * as MapUtil from "../../../util/map";
import {type NodeAddressT, type EdgeAddressT} from "../../../core/graph";
import type {NodeType, EdgeType} from "../../adapters/pluginAdapter";
import type {StaticPluginAdapter} from "../../adapters/pluginAdapter";
import type {StaticAdapterSet} from "../../adapters/adapterSet";

export type WeightedNodeType = {|+type: NodeType, +weight: number|};

export type WeightedEdgeType = {|
  +type: EdgeType,
  +forwardWeight: number,
  +backwardWeight: number,
|};

export type WeightedTypes = {|
  // Map from the weighted type's prefix to the type
  +nodes: Map<NodeAddressT, WeightedNodeType>,
  +edges: Map<EdgeAddressT, WeightedEdgeType>,
|};

export function defaultWeightedNodeType(type: NodeType): WeightedNodeType {
  return {
    type,
    weight: type.defaultWeight,
  };
}

export function defaultWeightedEdgeType(type: EdgeType): WeightedEdgeType {
  return {
    type,
    forwardWeight: type.defaultForwardWeight,
    backwardWeight: type.defaultBackwardWeight,
  };
}

export function defaultWeightsForAdapter(
  adapter: StaticPluginAdapter
): WeightedTypes {
  return {
    nodes: new Map(
      adapter.nodeTypes().map((x) => [x.prefix, defaultWeightedNodeType(x)])
    ),
    edges: new Map(
      adapter.edgeTypes().map((x) => [x.prefix, defaultWeightedEdgeType(x)])
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

export function defaultWeightsForAdapterSet(
  adapters: StaticAdapterSet
): WeightedTypes {
  return combineWeights(adapters.adapters().map(defaultWeightsForAdapter));
}
