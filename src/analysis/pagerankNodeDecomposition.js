// @flow

import sortBy from "lodash.sortby";

import type {NodeAddressT} from "../core/graph";
import {
  type Connection,
  type NodeToConnections,
  adjacencySource,
} from "../core/attribution/graphToMarkovChain";
import type {NodeScore} from "./nodeScore";
import * as MapUtil from "../util/map";
import * as NullUtil from "../util/null";
import {toCompat, fromCompat, type Compatible} from "../util/compat";

export type ScoredConnection = {|
  +connection: Connection,
  +source: NodeAddressT,
  +connectionScore: number,
|};

export type DecomposedNode = {|
  +score: number,
  // Connections are sorted by `adjacencyScore` descending,
  // breaking ties in a deterministic (but unspecified) order.
  +scoredConnections: $ReadOnlyArray<ScoredConnection>,
|};

export type PagerankNodeDecomposition = Map<NodeAddressT, DecomposedNode>;

export opaque type PagerankNodeDecompositionJSON = Compatible<{|
  [NodeAddressT]: DecomposedNode,
|}>;

const COMPAT_INFO = {
  type: "sourcecred/pagerankNodeDecomposition",
  version: "0.1.0",
};

export function toJSON(
  x: PagerankNodeDecomposition
): PagerankNodeDecompositionJSON {
  return toCompat(COMPAT_INFO, MapUtil.toObject(x));
}

export function fromJSON(
  x: PagerankNodeDecompositionJSON
): PagerankNodeDecomposition {
  return MapUtil.fromObject(fromCompat(COMPAT_INFO, x));
}

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
      // The following should be called rarely and on small objects.
      (x) => JSON.stringify(x.connection.adjacency)
    );
    return {score, scoredConnections};
  });
}
