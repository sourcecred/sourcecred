// @flow

import sortBy from "lodash.sortby";

import type {NodeAddressT} from "../graph";
import {
  type Connection,
  type NodeToConnections,
  adjacencySource,
} from "./graphToMarkovChain";
import type {NodeDistribution} from "./pagerank";
import * as MapUtil from "../../util/map";
import * as NullUtil from "../../util/null";

export type ScoredConnection = {|
  +connection: Connection,
  +source: NodeAddressT,
  +sourceScore: number,
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
  pr: NodeDistribution,
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
          return {connection, source, sourceScore, connectionScore};
        }
      ),
      (x) => -x.connectionScore,
      // The following should be called rarely and on small objects.
      (x) => JSON.stringify(x.connection.adjacency)
    );
    return {score, scoredConnections};
  });
}
