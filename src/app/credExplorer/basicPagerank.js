// @flow

import type {Address} from "../../core/address";
import type {Edge} from "../../core/graph";
import {AddressMap} from "../../core/address";
import {Graph} from "../../core/graph";

export type Distribution = AddressMap<{|
  +address: Address,
  +probability: number,
|}>;
export type PagerankResult = Distribution;

type MarkovChain = AddressMap<{|
  +address: Address,
  +inNeighbors: AddressMap<{|
    +address: Address,
    +weight: number,
  |}>,
|}>;

export default function basicPagerank(graph: Graph<any, any>): PagerankResult {
  return findStationaryDistribution(graphToMarkovChain(graph));
}

function edgeWeight(
  _unused_edge: Edge<any>
): {|+toWeight: number, +froWeight: number|} {
  return {toWeight: 1, froWeight: 1};
}

export function graphToMarkovChain(graph: Graph<any, any>): MarkovChain {
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

function markovChainAction(mc: MarkovChain, pi: Distribution): Distribution {
  const result = new AddressMap();
  mc.getAll().forEach(({address, inNeighbors}) => {
    let probability = 0;
    inNeighbors.getAll().forEach(({address: neighbor, weight}) => {
      probability += pi.get(neighbor).probability * weight;
    });
    result.add({address, probability});
  });
  return result;
}

function uniformDistribution(addresses: $ReadOnlyArray<Address>) {
  const result = new AddressMap();
  const probability = 1.0 / addresses.length;
  addresses.forEach((address) => {
    result.add({address, probability});
  });
  return result;
}

function findStationaryDistribution(mc: MarkovChain): Distribution {
  let r0 = uniformDistribution(mc.getAll().map(({address}) => address));
  function computeDelta(pi0, pi1) {
    return Math.max(
      ...pi0
        .getAll()
        .map(({address}) =>
          Math.abs(pi0.get(address).probability - pi1.get(address).probability)
        )
    );
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
