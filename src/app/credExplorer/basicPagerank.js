// @flow

import type {Address} from "../../core/address";
import type {Edge} from "../../core/graph";
import {AddressMap} from "../../core/address";
import {Graph} from "../../core/graph";

export type Distribution = {|
  +nodeOrder: $ReadOnlyArray<Address>,
  +data: Float64Array,
|};
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

type TypedArrayMarkovChain = {|
  +nodeOrder: $ReadOnlyArray<Address>,
  +inNeighbors: $ReadOnlyArray<{|
    +neighbors: Uint32Array,
    +inWeights: Float64Array,
  |}>,
|};

export default function basicPagerank(graph: Graph<any, any>): PagerankResult {
  return distributionToPagerankResult(
    findStationaryDistribution(graphToTypedArrayMarkovChain(graph))
  );
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

function addressMapMarkovChainToTypedArrayMarkovChain(
  mc: AddressMapMarkovChain
): TypedArrayMarkovChain {
  // The node ordering is arbitrary, but must be made canonical: calls
  // to `graph.nodes()` are not guaranteed to be stable.
  const nodeOrder = mc.getAll().map(({address}) => address);
  const addressToIndex = new AddressMap();
  nodeOrder.forEach((address, index) => {
    addressToIndex.add({address, index});
  });
  return {
    nodeOrder,
    inNeighbors: nodeOrder.map((address) => {
      const theseNeighbors = mc.get(address).inNeighbors.getAll();
      return {
        neighbors: new Uint32Array(
          theseNeighbors.map(({address}) => addressToIndex.get(address).index)
        ),
        inWeights: new Float64Array(theseNeighbors.map(({weight}) => weight)),
      };
    }),
  };
}

export function graphToTypedArrayMarkovChain(
  graph: Graph<any, any>
): TypedArrayMarkovChain {
  return addressMapMarkovChainToTypedArrayMarkovChain(
    graphToAddressMapMarkovChain(graph)
  );
}

function markovChainAction(
  mc: TypedArrayMarkovChain,
  pi: Distribution
): Distribution {
  const data = new Float64Array(pi.data.length);
  for (let dst = 0; dst < mc.nodeOrder.length; dst++) {
    const theseNeighbors = mc.inNeighbors[dst];
    const inDegree = theseNeighbors.neighbors.length;
    let probability = 0;
    for (let srcIndex = 0; srcIndex < inDegree; srcIndex++) {
      const src = theseNeighbors.neighbors[srcIndex];
      probability += pi.data[src] * theseNeighbors.inWeights[srcIndex];
    }
    data[dst] = probability;
  }
  return {nodeOrder: pi.nodeOrder, data};
}

function uniformDistribution(nodeOrder: $ReadOnlyArray<Address>): Distribution {
  return {
    nodeOrder,
    data: new Float64Array(
      Array(nodeOrder.length).fill(1.0 / nodeOrder.length)
    ),
  };
}

function findStationaryDistribution(mc: TypedArrayMarkovChain): Distribution {
  let r0 = uniformDistribution(mc.nodeOrder);
  function computeDelta(pi0, pi1) {
    // Here, we assume that `pi0.nodeOrder` and `pi1.nodeOrder` are the
    // same (i.e., there has been no permutation).
    return Math.max(...pi0.data.map((x, i) => Math.abs(x - pi1.data[i])));
  }
  let iteration = 0;
  while (true) {
    iteration++;
    const r1 = markovChainAction(mc, r0);
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

function distributionToPagerankResult(pi: Distribution): PagerankResult {
  const result = new AddressMap();
  pi.nodeOrder.forEach((address, i) => {
    const probability = pi.data[i];
    result.add({address, probability});
  });
  return result;
}
