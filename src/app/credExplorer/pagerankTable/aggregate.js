// @flow

import sortBy from "lodash.sortby";
import {NodeAddress, edgeToString} from "../../../core/graph";
import {NodeTrie, EdgeTrie} from "../../../core/trie";
import type {NodeType, EdgeType} from "../../adapters/pluginAdapter";
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
    const types = typeTrie.get(x.source);
    if (types.length === 0) {
      throw new Error(
        `No matching NodeType for ${NodeAddress.toString(x.source)}`
      );
    }
    const type = types[types.length - 1];
    const connections = nodeTypeToConnections.get(type) || [];
    if (connections.length === 0) {
      nodeTypeToConnections.set(type, connections);
    }
    connections.push(x);
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
    const types = typeTrie.get(edge.address);
    if (types.length === 0) {
      throw new Error(`No matching EdgeType for edge ${edgeToString(edge)}`);
    }
    const type = types[types.length - 1];
    const connections = relevantMap.get(type) || [];
    if (connections.length === 0) {
      relevantMap.set(type, connections);
    }
    connections.push(x);
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
