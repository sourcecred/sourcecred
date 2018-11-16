// @flow

import {
  type Edge,
  type Graph,
  type NodeAddressT,
  type EdgeAddressT,
} from "../graph";
import type {Distribution, SparseMarkovChain} from "./markovChain";
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

export type EdgeWeight = {|
  +toWeight: number, // weight from src to dst
  +froWeight: number, // weight from dst to src
|};

/*
 * WeightedGraph is a data structure that contains the information
 * we need to run PageRank on a graph.
 *
 * Every edge is associated with an un-normalized EdgeWeight, where by
 * "un-normalized" we mean the edge weights out of any given node need not sum
 * to 1. To make normalizing the graph convenient, we also store the total out
 * weight for every node.
 *
 * The graph as a whole has a syntheticLoopWeight, which is a tuning parameter
 * that is necessary so that even isolated nodes have at least one
 * out-connection. (Every node is given a synthetic loop, pointing back to
 * itself, with this weight.)
 *
 * While it is not verified at the type level, it is required that a weighted
 * graph have a bijective mapping between edge weights in the `edgeWeights`
 * map, and edge addresses in the graph. Similarly, there must be a bijective
 * mapping between the nodes in the graph and the nodeTotalOutWeights.
 */
export type WeightedGraph = {|
  +graph: Graph,
  +edgeWeights: Map<EdgeAddressT, EdgeWeight>,
  +nodeTotalOutWeights: Map<NodeAddressT, number>,
  +syntheticLoopWeight: number,
|};

export function createWeightedGraph(
  graph: Graph,
  edgeEvaluator: (Edge) => EdgeWeight,
  syntheticLoopWeight: number
): WeightedGraph {
  const edgeWeights = new Map();
  const nodeTotalOutWeights = new Map();
  for (const n of graph.nodes()) {
    nodeTotalOutWeights.set(n, syntheticLoopWeight);
  }
  for (const e of graph.edges()) {
    const weights = edgeEvaluator(e);
    const newSrcOutWeight =
      NullUtil.get(nodeTotalOutWeights.get(e.src)) + weights.toWeight;
    nodeTotalOutWeights.set(e.src, newSrcOutWeight);
    const newDstOutWeight =
      NullUtil.get(nodeTotalOutWeights.get(e.dst)) + weights.froWeight;
    nodeTotalOutWeights.set(e.dst, newDstOutWeight);
    edgeWeights.set(e.address, weights);
  }
  return {
    graph,
    edgeWeights,
    nodeTotalOutWeights,
    syntheticLoopWeight,
  };
}

export function createConnections(wg: WeightedGraph): NodeToConnections {
  const result = new Map();
  for (const node of wg.graph.nodes()) {
    result.set(node, []);
  }

  function addConnection(
    target: NodeAddressT,
    adjacency: Adjacency,
    weight: number
  ) {
    const source = adjacencySource(target, adjacency);
    const sourceWeight = NullUtil.get(wg.nodeTotalOutWeights.get(source));
    const connection = {
      adjacency,
      weight: weight / sourceWeight,
    };
    const connections = NullUtil.get(result.get(target));
    (((connections: $ReadOnlyArray<Connection>): any): Connection[]).push(
      connection
    );
  }

  // Add self-loops.
  for (const node of wg.graph.nodes()) {
    addConnection(node, {type: "SYNTHETIC_LOOP"}, wg.syntheticLoopWeight);
  }

  // Process edges.
  for (const edge of wg.graph.edges()) {
    const {toWeight, froWeight} = NullUtil.get(
      wg.edgeWeights.get(edge.address)
    );
    const {src, dst} = edge;
    addConnection(dst, {type: "IN_EDGE", edge}, toWeight);
    addConnection(src, {type: "OUT_EDGE", edge}, froWeight);
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
