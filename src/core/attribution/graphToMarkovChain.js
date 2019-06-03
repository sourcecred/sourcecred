// @flow

import {type Edge, type Graph, type NodeAddressT, NodeAddress} from "../graph";
import {
  type Distribution,
  type SparseMarkovChain,
  uniformDistribution,
} from "./markovChain";
import * as MapUtil from "../../util/map";
import * as NullUtil from "../../util/null";

export type Probability = number;
export type Adjacency =
  | {|+type: "SYNTHETIC_LOOP"|}
  | {|+type: "IN_EDGE", +edge: Edge|}
  | {|+type: "OUT_EDGE", +edge: Edge|};
export type Connection = {|
  +adjacency: Adjacency,
  // This `weight` is a conditional probability: given that you're at
  // the source of this connection's adjacency, what's the
  // probability that you travel along this connection to the target?
  +weight: Probability,
|};

export function adjacencySource(target: NodeAddressT, adjacency: Adjacency) {
  switch (adjacency.type) {
    case "SYNTHETIC_LOOP":
      return target;
    case "IN_EDGE":
      return adjacency.edge.src;
    case "OUT_EDGE":
      return adjacency.edge.dst;
    default:
      throw new Error((adjacency.type: empty));
  }
}

/**
 * Create a Distribution using provided node weights.
 *
 * weightedDistribution takes in a node order (as a read only array of NodeAddressT),
 * and a map providing weights for a subset of those nodes. It returns a Distribution
 * with the invariant that every node's weight is proportional to its relative weight
 * in the weights map. For example, in a case where there were three nodes and they
 * had weights of 0, 1, and 3 respectively, the distribution would be [0, 0.25, 0.75].
 *
 * If a node address is not present in the weight map, its weight is assumed to be 0.
 * If any weight is negative or non-finite, an error will be thrown.
 * If the sum of all weights is 0, then a uniform distribution will be returned.
 * If the weight map assigned weight to nodes which are not in the node order, an error
 * will be thrown.
 */
export function weightedDistribution(
  nodeOrder: $ReadOnlyArray<NodeAddressT>,
  weights: Map<NodeAddressT, number>
): Distribution {
  let totalWeight = 0;
  for (const [address, weight] of weights.entries()) {
    if (weight < 0 || !isFinite(weight)) {
      throw new Error(
        `Invalid weight ${weight} associated with address ${NodeAddress.toString(
          address
        )}`
      );
    }
    totalWeight += weight;
  }
  if (totalWeight === 0) {
    return uniformDistribution(nodeOrder.length);
  }
  let numEncounteredWeights = 0;
  const distribution = new Float64Array(nodeOrder.length);
  for (let i = 0; i < distribution.length; i++) {
    const weight = weights.get(nodeOrder[i]);
    if (weight != null) {
      numEncounteredWeights++;
      distribution[i] = weight / totalWeight;
    }
  }
  if (numEncounteredWeights !== weights.size) {
    throw new Error("weights included nodes not present in the nodeOrder");
  }
  return distribution;
}

export type NodeDistribution = Map<NodeAddressT, Probability>;

export type NodeToConnections = Map<NodeAddressT, $ReadOnlyArray<Connection>>;

type NodeAddressMarkovChain = Map<
  NodeAddressT,
  /* in-neighbors */ Map<NodeAddressT, Probability>
>;

export type OrderedSparseMarkovChain = {|
  +nodeOrder: $ReadOnlyArray<NodeAddressT>,
  +chain: SparseMarkovChain,
|};

// TODO(@decentralion): Rename these fields to `forwards` and `backwards` to
// deduplicate with the EdgeWeight type defined by analysis/weights
export type EdgeWeight = {|
  +toWeight: number, // weight from src to dst
  +froWeight: number, // weight from dst to src
|};

export function createConnections(
  graph: Graph,
  edgeWeight: (Edge) => EdgeWeight,
  syntheticLoopWeight: number
): NodeToConnections {
  const result = new Map();
  const totalOutWeight: Map<NodeAddressT, number> = new Map();
  for (const node of graph.nodes()) {
    result.set(node.address, []);
    totalOutWeight.set(node.address, 0);
  }

  function processConnection(target: NodeAddressT, connection: Connection) {
    const connections = NullUtil.get(result.get(target));
    (((connections: $ReadOnlyArray<Connection>): any): Connection[]).push(
      connection
    );
    const source = adjacencySource(target, connection.adjacency);
    const priorOutWeight = NullUtil.get(totalOutWeight.get(source));
    totalOutWeight.set(source, priorOutWeight + connection.weight);
  }

  // Add self-loops.
  for (const node of graph.nodes()) {
    processConnection(node.address, {
      adjacency: {type: "SYNTHETIC_LOOP"},
      weight: syntheticLoopWeight,
    });
  }

  // Process edges.
  for (const edge of graph.edges()) {
    const {toWeight, froWeight} = edgeWeight(edge);
    const {src, dst} = edge;
    processConnection(dst, {
      adjacency: {type: "IN_EDGE", edge},
      weight: toWeight,
    });
    processConnection(src, {
      adjacency: {type: "OUT_EDGE", edge},
      weight: froWeight,
    });
  }

  // Normalize in-weights.
  for (const [target, connections] of result.entries()) {
    for (const connection of connections) {
      const source = adjacencySource(target, connection.adjacency);
      const normalization = NullUtil.get(totalOutWeight.get(source));
      const newWeight: typeof connection.weight =
        connection.weight / normalization;
      // (any-cast because property is not writable)
      (connection: any).weight = newWeight;
    }
  }

  return result;
}

function createNodeAddressMarkovChain(
  ntc: NodeToConnections
): NodeAddressMarkovChain {
  return MapUtil.mapValues(ntc, (target, connections) => {
    const inNeighbors = new Map();
    for (const connection of connections) {
      const source = adjacencySource(target, connection.adjacency);
      inNeighbors.set(
        source,
        connection.weight + NullUtil.orElse(inNeighbors.get(source), 0)
      );
    }
    return inNeighbors;
  });
}

function nodeAddressMarkovChainToOrderedSparseMarkovChain(
  chain: NodeAddressMarkovChain
): OrderedSparseMarkovChain {
  const nodeOrder = Array.from(chain.keys());
  const addressToIndex: Map<NodeAddressT, number> = new Map();
  nodeOrder.forEach((node, index) => {
    addressToIndex.set(node, index);
  });
  return {
    nodeOrder,
    chain: nodeOrder.map((dst) => {
      const theseNeighbors = NullUtil.get(chain.get(dst));
      const result = {
        neighbor: new Uint32Array(theseNeighbors.size),
        weight: new Float64Array(theseNeighbors.size),
      };
      let i = 0;
      for (const [src, weight] of theseNeighbors.entries()) {
        const srcIndex = NullUtil.get(addressToIndex.get(src));
        result.neighbor[i] = srcIndex;
        result.weight[i] = weight;
        i++;
      }
      return result;
    }),
  };
}

export function createOrderedSparseMarkovChain(
  connections: NodeToConnections
): OrderedSparseMarkovChain {
  const chain = createNodeAddressMarkovChain(connections);
  return nodeAddressMarkovChainToOrderedSparseMarkovChain(chain);
}

/**
 * Return an equivalent form of the given chain whose `nodeOrder` is the
 * provided array, which must be a permutation of the node order of the
 * original chain.
 */
export function permute(
  old: OrderedSparseMarkovChain,
  newOrder: $ReadOnlyArray<NodeAddressT>
): OrderedSparseMarkovChain {
  const newIndices: {[NodeAddressT]: number} = {};
  const oldIndices: {[NodeAddressT]: number} = {};
  newOrder.forEach((node, i) => {
    newIndices[node] = i;
  });
  old.nodeOrder.forEach((node, i) => {
    oldIndices[node] = i;
  });
  const newChain = [];
  for (const node of newOrder) {
    const {neighbor: oldNeighbors, weight} = old.chain[oldIndices[node]];
    const newNeighbors = oldNeighbors.map(
      (oldIndex) => newIndices[old.nodeOrder[oldIndex]]
    );
    newChain.push({neighbor: newNeighbors, weight});
  }
  return {
    nodeOrder: newOrder,
    chain: newChain,
  };
}

/**
 * Return an equivalent form of the given chain such that for for each
 * node, the entries in `chain[node].neighbors` are sorted.
 */
export function normalizeNeighbors(
  old: OrderedSparseMarkovChain
): OrderedSparseMarkovChain {
  return {
    nodeOrder: old.nodeOrder,
    chain: old.chain.map(({neighbor, weight}) => {
      if (neighbor.length !== weight.length) {
        throw new Error(`${neighbor.length} !== ${weight.length}`);
      }
      const entries = Array(neighbor.length)
        .fill(null)
        .map((_, i) => ({neighbor: neighbor[i], weight: weight[i]}));
      entries.sort((a, b) => a.neighbor - b.neighbor);
      return {
        neighbor: new Uint32Array(entries.map((x) => x.neighbor)),
        weight: new Float64Array(entries.map((x) => x.weight)),
      };
    }),
  };
}

export function normalize(
  old: OrderedSparseMarkovChain
): OrderedSparseMarkovChain {
  return normalizeNeighbors(permute(old, old.nodeOrder.slice().sort()));
}

export function distributionToNodeDistribution(
  nodeOrder: $ReadOnlyArray<NodeAddressT>,
  pi: Distribution
): NodeDistribution {
  const result = new Map();
  nodeOrder.forEach((node, i) => {
    const probability = pi[i];
    result.set(node, probability);
  });
  return result;
}
