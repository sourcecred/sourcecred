// @flow

import {type Edge, type Graph, type NodeAddressT, NodeAddress} from "../graph";
import type {Distribution, SparseMarkovChain} from "./markovChain";

export type Probability = number;
export type Contributor =
  | {|+type: "SYNTHETIC_LOOP"|}
  | {|+type: "IN_EDGE", +edge: Edge|}
  | {|+type: "OUT_EDGE", +edge: Edge|};
export type Contribution = {|
  +contributor: Contributor,
  // This `weight` is a conditional probability: given that you're at
  // the source of this contribution's contributor, what's the
  // probability that you travel along this contribution to the target?
  +weight: Probability,
|};

export function contributorSource(
  target: NodeAddressT,
  contributor: Contributor
) {
  switch (contributor.type) {
    case "SYNTHETIC_LOOP":
      return target;
    case "IN_EDGE":
      return contributor.edge.src;
    case "OUT_EDGE":
      return contributor.edge.dst;
    default:
      throw new Error((contributor.type: empty));
  }
}

export type PagerankResult = Map<NodeAddressT, Probability>;

export type NodeToContributions = Map<
  NodeAddressT,
  $ReadOnlyArray<Contribution>
>;

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

export function createContributions(
  graph: Graph,
  edgeWeight: (Edge) => EdgeWeight,
  syntheticLoopWeight: number
): NodeToContributions {
  const result = new Map();
  const totalOutWeight: Map<NodeAddressT, number> = new Map();
  for (const node of graph.nodes()) {
    result.set(node, []);
    totalOutWeight.set(node, 0);
  }

  function processContribution(
    target: NodeAddressT,
    contribution: Contribution
  ) {
    const contributions = result.get(target);
    if (contributions == null) {
      // Should be impossible based on graph invariants.
      throw new Error("missing target: " + NodeAddress.toString(target));
    }
    (((contributions: $ReadOnlyArray<Contribution>): any): Contribution[]).push(
      contribution
    );

    const source = contributorSource(target, contribution.contributor);
    const priorOutWeight = totalOutWeight.get(source);
    if (priorOutWeight == null) {
      // Should be impossible based on graph invariants.
      throw new Error("missing source: " + NodeAddress.toString(source));
    }
    totalOutWeight.set(source, priorOutWeight + contribution.weight);
  }

  // Add self-loops.
  for (const node of graph.nodes()) {
    processContribution(node, {
      contributor: {type: "SYNTHETIC_LOOP"},
      weight: syntheticLoopWeight,
    });
  }

  // Process edges.
  for (const edge of graph.edges()) {
    const {toWeight, froWeight} = edgeWeight(edge);
    const {src, dst} = edge;
    processContribution(dst, {
      contributor: {type: "IN_EDGE", edge},
      weight: toWeight,
    });
    processContribution(src, {
      contributor: {type: "OUT_EDGE", edge},
      weight: froWeight,
    });
  }

  // Normalize in-weights.
  for (const [target, contributions] of result.entries()) {
    for (const contribution of contributions) {
      const source = contributorSource(target, contribution.contributor);
      const normalization = totalOutWeight.get(source);
      if (normalization == null) {
        // Should be impossible.
        throw new Error("missing node: " + NodeAddress.toString(source));
      }
      const newWeight: typeof contribution.weight =
        contribution.weight / normalization;
      // (any-cast because property is not writable)
      (contribution: any).weight = newWeight;
    }
  }

  return result;
}

function createNodeAddressMarkovChain(
  ntc: NodeToContributions
): NodeAddressMarkovChain {
  const result: NodeAddressMarkovChain = new Map();
  for (const [target, contributions] of ntc.entries()) {
    const inNeighbors = new Map();
    result.set(target, inNeighbors);
    for (const contribution of contributions) {
      const source = contributorSource(target, contribution.contributor);
      inNeighbors.set(
        source,
        contribution.weight + (inNeighbors.get(source) || 0)
      );
    }
  }
  return result;
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

export function createOrderedSparseMarkovChain(
  contributions: NodeToContributions
): OrderedSparseMarkovChain {
  const chain = createNodeAddressMarkovChain(contributions);
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
