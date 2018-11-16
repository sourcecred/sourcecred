// @flow

import sortBy from "lodash.sortby";

import type {NodeAddressT} from "../core/graph";
import {
  type Connection,
  type NodeToConnections,
  adjacencySource,
  type WeightedGraph,
  singleNodeConnections,
} from "../core/attribution/graphToMarkovChain";
import type {NodeScore} from "./nodeScore";
import * as MapUtil from "../util/map";
import * as NullUtil from "../util/null";

export type ScoredConnection = {|
  +connection: Connection,
  +source: NodeAddressT,
  +connectionScore: number,
|};

export type PagerankNodeDecomposition = Map<
  NodeAddressT,
  {|
    +score: number,
    // Connections are sorted by `adjacencyScore` descending,
    // breaking ties in a deterministic (but unspecified) order.
    +scoredConnections: $ReadOnlyArray<ScoredConnection>,
  |}
>;

export function decompose(
  pr: NodeScore,
  connections: NodeToConnections
): PagerankNodeDecomposition {
  return MapUtil.mapValues(connections, (target, connections) => {
    const score = NullUtil.get(pr.get(target));
    const scoredConnections = sortBy(
      connections.map(
        (connection): ScoredConnection => {
          const source = adjacencySource(target, connection.adjacency);
          const sourceScore = NullUtil.get(pr.get(source));
          const connectionScore = connection.weight * sourceScore;
          return {connection, source, connectionScore};
        }
      ),
      (x) => -x.connectionScore,
      (x) => x.connection.adjacency.type,
      (x) => {
        switch (x.connection.adjacency.type) {
          case "IN_EDGE":
            return x.connection.adjacency.edge.address;
          case "OUT_EDGE":
            return x.connection.adjacency.edge.address;
          case "SYNTHETIC_LOOP":
            return "";
          default:
            throw new Error((x.connection.adjacency.type: empty));
        }
      }
    );
    return {score, scoredConnections};
  });
}

/*
 * Given a weighted graph with associated scores, compute the scoredConnections
 * for a particular node.
 *
 * `scoredConnections(wg, scores, n)`
 * is equivalent to
 * `decompose(scores, createConnections(wg)).get(n).scoredConnections`
 *
 * If you only need the decomposition for a single node, then calling
 * this method is much more efficient.
 */
export function scoredConnections(
  wg: WeightedGraph,
  scores: NodeScore,
  target: NodeAddressT
): ScoredConnection[] {
  const connections = singleNodeConnections(wg, target);
  const scoredConnections: ScoredConnection[] = connections.map(
    (connection) => {
      const source = adjacencySource(target, connection.adjacency);
      const sourceScore = NullUtil.get(scores.get(source));
      const connectionScore = connection.weight * sourceScore;
      return {connection, source, connectionScore};
    }
  );
  return sortBy(
    scoredConnections,
    (x) => -x.connectionScore,
    (x) => x.connection.adjacency.type,
    (x) => {
      switch (x.connection.adjacency.type) {
        case "IN_EDGE":
          return x.connection.adjacency.edge.address;
        case "OUT_EDGE":
          return x.connection.adjacency.edge.address;
        case "SYNTHETIC_LOOP":
          return "";
        default:
          throw new Error((x.connection.adjacency.type: empty));
      }
    }
  );
}
