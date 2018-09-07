// @flow

import sortBy from "lodash.sortby";
import stringify from "json-stable-stringify";
import * as MapUtil from "../../../util/map";
import {NodeTrie, EdgeTrie} from "../../../core/trie";
import type {NodeType, EdgeType} from "../../adapters/pluginAdapter";
import type {ScoredConnection} from "../../../core/attribution/pagerankNodeDecomposition";

// Sorted by descending `summary.score`
export type FlatAggregations = $ReadOnlyArray<FlatAggregation>;
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

export type FlatAggregation = {|
  +connectionType: ConnectionType,
  +nodeType: NodeType,
  +summary: AggregationSummary,
  // sorted by `scoredConnection.connectionScore`
  +connections: $ReadOnlyArray<ScoredConnection>,
|};

export function aggregateByNodeType(
  xs: $ReadOnlyArray<ScoredConnection>,
  nodeTypes: $ReadOnlyArray<NodeType>
): $ReadOnlyArray<NodeAggregation> {
  const typeTrie = new NodeTrie();
  for (const nodeType of nodeTypes) {
    typeTrie.add(nodeType.prefix, nodeType);
  }
  const nodeTypeToConnections = new Map();
  for (const x of xs) {
    const type = typeTrie.getLast(x.source);
    MapUtil.pushValue(nodeTypeToConnections, type, x);
  }
  const aggregations: NodeAggregation[] = [];
  for (const [
    nodeType: NodeType,
    connections: ScoredConnection[],
  ] of nodeTypeToConnections) {
    const connectionScores = connections.map((x) => x.connectionScore);
    const aggregation = {
      nodeType,
      connections: sortBy(connections, (x) => -x.connectionScore),
      summary: {
        size: connections.length,
        score: connectionScores.reduce((a, b) => a + b),
      },
    };
    aggregations.push(aggregation);
  }
  return sortBy(aggregations, (x) => -x.summary.score);
}

type EdgeTypeToConnection = Map<EdgeType, ScoredConnection[]>;
export function aggregateByConnectionType(
  xs: $ReadOnlyArray<ScoredConnection>,
  nodeTypes: $ReadOnlyArray<NodeType>,
  edgeTypes: $ReadOnlyArray<EdgeType>
): ConnectionAggregations {
  const typeTrie = new EdgeTrie();
  for (const edgeType of edgeTypes) {
    typeTrie.add(edgeType.prefix, edgeType);
  }
  const syntheticConnections = [];
  const inEdgeTypeToConnections: EdgeTypeToConnection = new Map();
  const outEdgeTypeToConnections: EdgeTypeToConnection = new Map();

  for (const x of xs) {
    let relevantMap: EdgeTypeToConnection;
    switch (x.connection.adjacency.type) {
      case "SYNTHETIC_LOOP":
        syntheticConnections.push(x);
        continue;
      case "IN_EDGE":
        relevantMap = inEdgeTypeToConnections;
        break;
      case "OUT_EDGE":
        relevantMap = outEdgeTypeToConnections;
        break;
      default:
        throw new Error((x.connection.adjacency.type: empty));
    }
    const edge = x.connection.adjacency.edge;
    const type = typeTrie.getLast(edge.address);
    MapUtil.pushValue(relevantMap, type, x);
  }

  function createAggregation(
    connectionType: ConnectionType,
    connections: $ReadOnlyArray<ScoredConnection>
  ): ConnectionAggregation {
    const nodeAggregations = aggregateByNodeType(connections, nodeTypes);
    const scores = nodeAggregations.map((x) => x.summary.score);
    const score = scores.reduce((a, b) => a + b);
    return {
      connectionType,
      summary: {size: connections.length, score},
      nodeAggregations,
    };
  }

  const result = [];
  if (syntheticConnections.length > 0) {
    const connectionType = {type: "SYNTHETIC_LOOP"};
    result.push(createAggregation(connectionType, syntheticConnections));
  }
  for (const [edgeType, connections] of inEdgeTypeToConnections) {
    const connectionType = {type: "IN_EDGE", edgeType};
    result.push(createAggregation(connectionType, connections));
  }
  for (const [edgeType, connections] of outEdgeTypeToConnections) {
    const connectionType = {type: "OUT_EDGE", edgeType};
    result.push(createAggregation(connectionType, connections));
  }

  return sortBy(result, (x) => -x.summary.score);
}

export function flattenAggregation(
  xs: ConnectionAggregations
): FlatAggregations {
  const result = [];
  for (const {connectionType, nodeAggregations} of xs) {
    for (const {summary, connections, nodeType} of nodeAggregations) {
      const flat: FlatAggregation = {
        summary,
        connections,
        nodeType,
        connectionType,
      };
      result.push(flat);
    }
  }
  return sortBy(result, (x) => -x.summary.score);
}

export function aggregateFlat(
  xs: $ReadOnlyArray<ScoredConnection>,
  nodeTypes: $ReadOnlyArray<NodeType>,
  edgeTypes: $ReadOnlyArray<EdgeType>
): FlatAggregations {
  return flattenAggregation(
    aggregateByConnectionType(xs, nodeTypes, edgeTypes)
  );
}

export function aggregationKey(aggregation: FlatAggregation): string {
  const result: any = {
    nodePrefix: aggregation.nodeType.prefix,
  };
  switch (aggregation.connectionType.type) {
    case "SYNTHETIC_LOOP":
      result.connectionType = {type: "SYNTHETIC_LOOP"};
      break;
    case "IN_EDGE":
      result.connectionType = {
        type: "IN_EDGE",
        edgePrefix: aggregation.connectionType.edgeType.prefix,
      };
      break;
    case "OUT_EDGE":
      result.connectionType = {
        type: "OUT_EDGE",
        edgePrefix: aggregation.connectionType.edgeType.prefix,
      };
      break;
    default:
      throw new Error((aggregation.connectionType.type: empty));
  }
  return stringify(result);
}
