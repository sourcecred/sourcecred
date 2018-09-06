// @flow

import {NodeAddress, EdgeAddress} from "../../../core/graph";
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
  +nodes: $ReadOnlyArray<WeightedNodeType>,
  +edges: $ReadOnlyArray<WeightedEdgeType>,
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
    nodes: adapter.nodeTypes().map(defaultWeightedNodeType),
    edges: adapter.edgeTypes().map(defaultWeightedEdgeType),
  };
}

export function combineWeights(
  ws: $ReadOnlyArray<WeightedTypes>
): WeightedTypes {
  const seenPrefixes = new Set();
  const nodes = [].concat(...ws.map((x) => x.nodes));
  for (const {
    type: {prefix},
  } of nodes) {
    if (seenPrefixes.has(prefix)) {
      throw new Error(`Duplicate prefix: ${NodeAddress.toString(prefix)}`);
    }
    seenPrefixes.add(prefix);
  }
  const edges = [].concat(...ws.map((x) => x.edges));
  for (const {
    type: {prefix},
  } of edges) {
    if (seenPrefixes.has(prefix)) {
      throw new Error(`Duplicate prefix: ${EdgeAddress.toString(prefix)}`);
    }
    seenPrefixes.add(prefix);
  }
  return {nodes, edges};
}

export function defaultWeightsForAdapterSet(
  adapters: StaticAdapterSet
): WeightedTypes {
  return combineWeights(adapters.adapters().map(defaultWeightsForAdapter));
}
