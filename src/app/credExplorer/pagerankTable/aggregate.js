// @flow

import type {NodeType, EdgeType} from "../../pluginAdapter";
import type {ScoredConnection} from "../../../core/attribution/pagerankNodeDecomposition";

// Sorted by descending `summary.score`
export type ConnectionAggregations = $ReadOnlyArray<ConnectionAggregation>;

export type AggregationSummary = {|
  +size: number,
  +score: number,
|};

export type NodeAggregation = {|
  +nodeType: NodeType,
  +summary: AggregationSummary,
  +connections: $ReadOnlyArray<ScoredConnection>,
|};

export type ConnectionType =
  | {|+type: "IN_EDGE", +edgeType: EdgeType|}
  | {|+type: "OUT_EDGE", +edgeType: EdgeType|}
  | {|+type: "SYNTHETIC_LOOP"|};

export type ConnectionAggregation = {|
  +connectionType: ConnectionType,
  +summary: AggregationSummary,
  // Sorted by descending `summary.score`
  +nodeAggregations: $ReadOnlyArray<NodeAggregation>,
|};

export function aggregateByConnectionType(
  xs: $ReadOnlyArray<ScoredConnection>,
  nodeTypes: $ReadOnlyArray<NodeType>,
  edgeTypes: $ReadOnlyArray<EdgeType>
): ConnectionAggregations {
  const _unused_stuff = [xs, edgeTypes, nodeTypes];
  throw new Error("Not yet implemented");
}
