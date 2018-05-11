// @flow

import type {Address} from "../../core/address";
import type {Edge} from "../../core/graph";
import {AddressMap} from "../../core/address";
import {Graph} from "../../core/graph";

import type {
  Distribution,
  SparseMarkovChain,
} from "../../core/attribution/markovChain";
import {
  sparseMarkovChainAction,
  uniformDistribution,
} from "../../core/attribution/markovChain";

export type PagerankResult = AddressMap<{|
  +address: Address,
  +probability: number,
|}>;

type AddressMapMarkovChain = AddressMap<{|
  +address: Address,
  +inNeighbors: AddressMap<{|
    +address: Address,
    +weight: number,
  |}>,
|}>;

type OrderedSparseMarkovChain = {|
  +nodeOrder: $ReadOnlyArray<Address>,
  +chain: SparseMarkovChain,
|};

export default function basicPagerank(graph: Graph<any, any>): PagerankResult {
  const {nodeOrder, chain} = graphToOrderedSparseMarkovChain(graph);
  const pi = findStationaryDistribution(chain);
  return distributionToPagerankResult(nodeOrder, pi);
}

function edgeWeight(
  _unused_edge: Edge<any>
): {|+toWeight: number, +froWeight: number|} {
  return {toWeight: 1, froWeight: 1};
}

function graphToAddressMapMarkovChain(
  graph: Graph<any, any>
): AddressMapMarkovChain {
  const result = new AddressMap();
  const unnormalizedTotalOutWeights = new AddressMap();

  function initializeNode(address) {
    if (result.get(address) != null) {
      return;
    }
    const inNeighbors = new AddressMap();
    result.add({address, inNeighbors});
    const selfLoopEdgeWeight = 1e-3;
    unnormalizedTotalOutWeights.add({address, weight: selfLoopEdgeWeight});
    graph.neighborhood(address).forEach(({neighbor}) => {
      inNeighbors.add({address: neighbor, weight: 0});
    });
    inNeighbors.add({address: address, weight: selfLoopEdgeWeight});
  }

  graph.nodes().forEach(({address}) => {
    initializeNode(address);
  });
  graph.edges().forEach((edge) => {
    const {src, dst} = edge;
    initializeNode(src);
    initializeNode(dst);
    const {toWeight, froWeight} = edgeWeight(edge);
    result.get(dst).inNeighbors.get(src).weight += toWeight;
    result.get(src).inNeighbors.get(dst).weight += froWeight;
    unnormalizedTotalOutWeights.get(src).weight += toWeight;
    unnormalizedTotalOutWeights.get(dst).weight += froWeight;
  });

  // Normalize.
  result.getAll().forEach(({inNeighbors}) => {
    inNeighbors.getAll().forEach((entry) => {
      entry.weight /= unnormalizedTotalOutWeights.get(entry.address).weight;
    });
  });
  return result;
}

function addressMapMarkovChainToOrderedSparseMarkovChain(
  chain: AddressMapMarkovChain
): OrderedSparseMarkovChain {
  // The node ordering is arbitrary, but must be made canonical: calls
  // to `graph.nodes()` are not guaranteed to be stable.
  const nodeOrder = chain.getAll().map(({address}) => address);
  const addressToIndex = new AddressMap();
  nodeOrder.forEach((address, index) => {
    addressToIndex.add({address, index});
  });
  return {
    nodeOrder,
    chain: nodeOrder.map((address) => {
      const theseNeighbors = chain.get(address).inNeighbors.getAll();
      return {
        neighbor: new Uint32Array(
          theseNeighbors.map(({address}) => addressToIndex.get(address).index)
        ),
        weight: new Float64Array(theseNeighbors.map(({weight}) => weight)),
      };
    }),
  };
}

export function graphToOrderedSparseMarkovChain(
  graph: Graph<any, any>
): OrderedSparseMarkovChain {
  return addressMapMarkovChainToOrderedSparseMarkovChain(
    graphToAddressMapMarkovChain(graph)
  );
}

function findStationaryDistribution(chain: SparseMarkovChain): Distribution {
  let r0 = uniformDistribution(chain.length);
  function computeDelta(pi0, pi1) {
    // Here, we assume that `pi0.nodeOrder` and `pi1.nodeOrder` are the
    // same (i.e., there has been no permutation).
    return Math.max(...pi0.map((x, i) => Math.abs(x - pi1[i])));
  }
  let iteration = 0;
  while (true) {
    iteration++;
    const r1 = sparseMarkovChainAction(chain, r0);
    const delta = computeDelta(r0, r1);
    r0 = r1;
    console.log(`[${iteration}] delta = ${delta}`);
    if (delta < 1e-7) {
      console.log(`[${iteration}] CONVERGED`);
      return r0;
    }
    if (iteration >= 255) {
      console.log(`[${iteration}] FAILED to converge`);
      return r0;
    }
  }
  // ESLint knows that this next line is unreachable, but Flow doesn't. :-)
  // eslint-disable-next-line no-unreachable
  throw new Error("Unreachable.");
}

function distributionToPagerankResult(
  nodeOrder: $ReadOnlyArray<Address>,
  pi: Distribution
): PagerankResult {
  const result = new AddressMap();
  nodeOrder.forEach((address, i) => {
    const probability = pi[i];
    result.add({address, probability});
  });
  return result;
}
