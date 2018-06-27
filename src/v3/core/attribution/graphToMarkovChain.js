// @flow

import {type Edge, type Graph, type NodeAddressT, NodeAddress} from "../graph";
import type {Distribution, SparseMarkovChain} from "./markovChain";

export type Probability = number;
export type PagerankResult = Map<NodeAddressT, Probability>;

type AddressMapMarkovChain = Map<
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

function graphToAddressMapMarkovChain(
  graph: Graph,
  edgeWeight: (Edge) => EdgeWeight,
  selfLoopEdgeWeight: number
): AddressMapMarkovChain {
  const inNeighbors: AddressMapMarkovChain = new Map();
  const totalOutWeight: Map<NodeAddressT, number> = new Map();
  for (const node of graph.nodes()) {
    inNeighbors.set(node, new Map());
    totalOutWeight.set(node, 0);
  }

  function moreWeight(src, dst, weight) {
    const neighbors = inNeighbors.get(dst);
    if (neighbors == null) {
      // Should be impossible based on graph invariants.
      throw new Error("missing dst: " + NodeAddress.toString(dst));
    }
    neighbors.set(src, weight + (neighbors.get(src) || 0));

    const priorOutWeight = totalOutWeight.get(src);
    if (priorOutWeight == null) {
      // Should be impossible based on graph invariants.
      throw new Error("missing src: " + NodeAddress.toString(src));
    }
    totalOutWeight.set(src, priorOutWeight + weight);
  }

  // Add self-loops.
  for (const node of graph.nodes()) {
    moreWeight(node, node, selfLoopEdgeWeight);
  }

  // Process edges.
  for (const edge of graph.edges()) {
    const {toWeight, froWeight} = edgeWeight(edge);
    const {src, dst} = edge;
    moreWeight(src, dst, toWeight);
    moreWeight(dst, src, froWeight);
  }

  // Normalize in-weights.
  for (const neighbors of inNeighbors.values()) {
    for (const [neighbor, weight] of neighbors.entries()) {
      const normalization = totalOutWeight.get(neighbor);
      if (normalization == null) {
        // Should be impossible.
        throw new Error("missing node: " + NodeAddress.toString(neighbor));
      }
      neighbors.set(neighbor, weight / normalization);
    }
  }
  return inNeighbors;
}

function addressMapMarkovChainToOrderedSparseMarkovChain(
  chain: AddressMapMarkovChain
): OrderedSparseMarkovChain {
  const nodeOrder = Array.from(chain.keys());
  const addressToIndex: Map<NodeAddressT, number> = new Map();
  nodeOrder.forEach((node, index) => {
    addressToIndex.set(node, index);
  });
  return {
    nodeOrder,
    chain: nodeOrder.map((dst) => {
      const theseNeighbors = chain.get(dst);
      if (theseNeighbors == null) {
        // Should be impossible.
        throw new Error("missing key: " + NodeAddress.toString(dst));
      }
      const result = {
        neighbor: new Uint32Array(theseNeighbors.size),
        weight: new Float64Array(theseNeighbors.size),
      };
      let i = 0;
      for (const [src, weight] of theseNeighbors.entries()) {
        const srcIndex = addressToIndex.get(src);
        if (srcIndex == null) {
          // Should be impossible.
          throw new Error("missing neighbor: " + NodeAddress.toString(src));
        }
        result.neighbor[i] = srcIndex;
        result.weight[i] = weight;
        i++;
      }
      return result;
    }),
  };
}

export function graphToOrderedSparseMarkovChain(
  graph: Graph,
  edgeWeight: (Edge) => EdgeWeight,
  selfLoopEdgeWeight: number
): OrderedSparseMarkovChain {
  return addressMapMarkovChainToOrderedSparseMarkovChain(
    graphToAddressMapMarkovChain(graph, edgeWeight, selfLoopEdgeWeight)
  );
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
  return {nodeOrder: newOrder, chain: newChain};
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

export function distributionToPagerankResult(
  nodeOrder: $ReadOnlyArray<NodeAddressT>,
  pi: Distribution
): PagerankResult {
  const result = new Map();
  nodeOrder.forEach((node, i) => {
    const probability = pi[i];
    result.set(node, probability);
  });
  return result;
}
