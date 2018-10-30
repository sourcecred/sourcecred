// @flow

import * as MapUtil from "../../../util/map";
import {type NodeAddressT, type EdgeAddressT} from "../../../core/graph";
import type {EdgeType, NodeType} from "../../../analysis/types";
import type {StaticAppAdapter} from "../../adapters/appAdapter";
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
  adapter: StaticAppAdapter
): WeightedTypes {
  return {
    nodes: new Map(
      adapter
        .declaration()
        .nodeTypes.map((x) => [x.prefix, defaultWeightedNodeType(x)])
    ),
    edges: new Map(
      adapter
        .declaration()
        .edgeTypes.map((x) => [x.prefix, defaultWeightedEdgeType(x)])
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
