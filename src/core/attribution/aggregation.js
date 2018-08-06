// @flow

import type {NodeType, EdgeType} from "../graph";
import type {ScoredConnection} from "./pagerankNodeDecomposition";

export type ConnectionType =
  | {|+type: "IN_EDGE", +edgeType: EdgeType|}
  | {|+type: "OUT_EDGE", +edgeType: EdgeType|}
  | {|+type: "SYNTHETIC_LOOP"|};

export type AggregationSummary = {|
  +size: number,
  +aggregateScore: number,
|};

export type ConnectionAggregation = {|
  +connectionType: ConnectionType,
  +aggregationSummary: AggregationSummary,
  +nodeAggregations: NodeAggregation[],
|};

export type NodeAggregation = {|
  +nodeType: NodeType,
  +aggregationSummary: AggregationSummary,
  +connections: ScoredConnection,
|};

export function aggregateConnections(
  xs: $ReadOnlyArray<ScoredConnection>,
  edgeTypes: $ReadOnlyArray<EdgeType>,
  nodeTypes: $ReadOnlyArray<NodeType>
): ConnectionAggregation[] {
  const _unused_stuff = [xs, edgeTypes, nodeTypes];
  throw new Error("Not yet implemented");
}
