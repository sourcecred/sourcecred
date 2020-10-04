// @flow

import type {TimelineCredScores} from "../core/algorithm/distributionToCred";
import {
  type DependencyMintPolicy,
  processMintPolicy,
} from "../core/dependenciesMintPolicy";
import {type NodeAddressT, NodeAddress} from "../core/graph";
import {IDENTITY_PREFIX} from "../ledger/identity";
import {type IntervalSequence, intervalSequence} from "../core/interval";

/**
 * Comprehensive data on a cred distribution.
 */
export type CredData = {|
  // Cred level information, always stored in graph address order.
  +nodeSummaries: $ReadOnlyArray<NodeCredSummary>,
  +nodeOverTime: $ReadOnlyArray<NodeCredOverTime | null>,
  +edgeSummaries: $ReadOnlyArray<EdgeCredSummary>,
  +edgeOverTime: $ReadOnlyArray<EdgeCredOverTime | null>,
  +intervals: IntervalSequence,
|};

/** Summary of a node's cred across all time.
 *
 * CredData includes this information for every node in the graph, regardless of its score.
 */
export type NodeCredSummary = {|
  // Total Cred for this node
  +cred: number,
  // How much of the total Cred came from the seed
  +seedFlow: number,
  // How much of the total Cred came from synthetic self loop
  +syntheticLoopFlow: number,
  // How much of the total Cred came from dependency minting
  +dependencyMintedCred: number,
|};

/**
 * A node's cred data at interval time resolution.
 *
 * To save space, the CredData may filter out the NodeCredOverTime entirely
 * for nodes with low score, or may filter out the seedFlow or syntheticLoopFlow
 * fields if either was trivial.
 */
export type NodeCredOverTime = {|
  +cred: $ReadOnlyArray<number>,
  +seedFlow: $ReadOnlyArray<number> | null,
  +syntheticLoopFlow: $ReadOnlyArray<number> | null,
  +dependencyMintedCred: $ReadOnlyArray<number> | null,
|};

/**
 * An edge's cred flows across all time.
 *
 * CredData includes this for every edge in the graph, regardless of its cred flows.
 */
export type EdgeCredSummary = {|
  +forwardFlow: number,
  +backwardFlow: number,
|};

/**
 * An edge's cred flows at interval time resolution.
 *
 * To save space, we may filter out this struct entirely for low-cred-flow edges, or we might
 * skip either the forwardFlow or backwardFlow fields if it had negligible cred flows in either direction.
 */
export type EdgeCredOverTime = {|
  +forwardFlow: $ReadOnlyArray<number> | null,
  +backwardFlow: $ReadOnlyArray<number> | null,
|};

export function computeCredData(
  scores: TimelineCredScores,
  nodeOrder: $ReadOnlyArray<NodeAddressT>,
  dependencyPolicies: $ReadOnlyArray<DependencyMintPolicy>
): CredData {
  const numIntervals = scores.length;
  if (numIntervals === 0) {
    return {
      nodeSummaries: [],
      nodeOverTime: [],
      edgeSummaries: [],
      edgeOverTime: [],
      intervals: intervalSequence([]),
    };
  }
  const intervals = intervalSequence(scores.map((d) => d.interval));
  const processedDependencyPolicies = dependencyPolicies.map((p) =>
    processMintPolicy(p, nodeOrder, intervals)
  );
  const numNodes = scores[0].cred.length;
  const numEdges = scores[0].forwardFlow.length;
  const nodeSummaries: $ReadOnlyArray<{|
    cred: number,
    dependencyMintedCred: number,
    seedFlow: number,
    syntheticLoopFlow: number,
  |}> = new Array(numNodes).fill(null).map(() => ({
    cred: 0,
    seedFlow: 0,
    syntheticLoopFlow: 0,
    dependencyMintedCred: 0,
  }));
  const nodeOverTime: $ReadOnlyArray<{|
    +cred: number[],
    +dependencyMintedCred: number[],
    +seedFlow: number[],
    +syntheticLoopFlow: number[],
  |}> = new Array(numNodes).fill(null).map(() => ({
    cred: new Array(numIntervals),
    seedFlow: new Array(numIntervals),
    syntheticLoopFlow: new Array(numIntervals),
    dependencyMintedCred: new Array(numIntervals),
  }));
  const edgeSummaries = new Array(numEdges).fill(null).map(() => ({
    forwardFlow: 0,
    backwardFlow: 0,
  }));
  const edgeOverTime = new Array(numEdges).fill(null).map(() => ({
    forwardFlow: new Array(numIntervals),
    backwardFlow: new Array(numIntervals),
  }));
  for (let i = 0; i < numIntervals; i++) {
    const {
      cred,
      forwardFlow,
      backwardFlow,
      seedFlow,
      syntheticLoopFlow,
    } = scores[i];
    let intervalTotalParticipantCred = 0;
    for (let n = 0; n < numNodes; n++) {
      const addr = nodeOrder[n];
      if (NodeAddress.hasPrefix(addr, IDENTITY_PREFIX)) {
        // We want the dependency's mint amount to be a fraction of the
        // total participant Cred, not the total Cred of all participants plus
        // all contributions.
        intervalTotalParticipantCred += cred[n];
      }
      nodeSummaries[n].cred += cred[n];
      nodeOverTime[n].cred[i] = cred[n];
      nodeSummaries[n].seedFlow += seedFlow[n];
      nodeOverTime[n].seedFlow[i] = seedFlow[n];
      nodeSummaries[n].syntheticLoopFlow += syntheticLoopFlow[n];
      nodeOverTime[n].syntheticLoopFlow[i] = syntheticLoopFlow[n];
      // Pre-fill with 0 to ensure a value for every node
      nodeOverTime[n].dependencyMintedCred[i] = 0;
    }
    for (const {nodeIndex, intervalWeights} of processedDependencyPolicies) {
      const weight = intervalWeights[i];
      const mintedCred = weight * intervalTotalParticipantCred;
      nodeSummaries[nodeIndex].cred += mintedCred;
      nodeSummaries[nodeIndex].dependencyMintedCred += mintedCred;
      nodeOverTime[nodeIndex].cred[i] += mintedCred;
      nodeOverTime[nodeIndex].dependencyMintedCred[i] = mintedCred;
    }
    for (let e = 0; e < numEdges; e++) {
      edgeSummaries[e].forwardFlow += forwardFlow[e];
      edgeOverTime[e].forwardFlow[i] = forwardFlow[e];
      edgeSummaries[e].backwardFlow += backwardFlow[e];
      edgeOverTime[e].backwardFlow[i] = backwardFlow[e];
    }
  }
  return {
    nodeSummaries,
    nodeOverTime,
    edgeSummaries,
    edgeOverTime,
    intervals: intervalSequence(intervals),
  };
}

/**
 * Compress the cred data by removing all time-level info on
 * flows/accumulations that sum to less than the threshold.
 *
 * E.g. if we set the threshold to 10 and a node has only 9 cred, we store its
 * summary info but not how those flows split across time.
 *
 * If the node had 11 cred but only 1 cred from seed and 0 from synthetic loop,
 * then we store the timing info for its cred, but not for its seed or
 * synthetic loop flows.
 *
 * Likewise for edges, we separately decide whether to store the forward flow
 * and the backward flow.
 */
export function compressByThreshold(x: CredData, threshold: number): CredData {
  const {
    nodeSummaries,
    nodeOverTime,
    edgeSummaries,
    edgeOverTime,
    intervals,
  } = x;

  const newNodeOverTime = nodeOverTime.map((d, i) => {
    if (d == null) {
      // It might be null if the data was already compressed. The function
      // should be idempotent. This way we can chain compression strategies
      // later on.
      return null;
    }
    const s = nodeSummaries[i];
    if (s.cred < threshold) {
      // If the cred is below threshold, then we know both the seed flow and
      // the synthetic loop flow are below threshold, since the cred is the sum
      // of those flows plus the flows from edges. So we can shortcut straight
      // to returning null.
      return null;
    }
    return {
      // We get a space efficiency boost here, since for the majority of nodes,
      // even though they have material cred, they have little seed or
      // synthetic loop flow. So we can save ourselves from storing large
      // arrays of near-zero values.
      cred: d.cred,
      seedFlow: s.seedFlow < threshold ? null : d.seedFlow,
      syntheticLoopFlow:
        s.syntheticLoopFlow < threshold ? null : d.syntheticLoopFlow,
      dependencyMintedCred:
        s.dependencyMintedCred < threshold ? null : d.dependencyMintedCred,
    };
  });

  const newEdgeOverTime = edgeOverTime.map((d, i) => {
    if (d == null) {
      // It might be null if the data was already compressed. The function
      // should be idempotent. This way we can chain compression strategies
      // later on.
      return null;
    }
    const {forwardFlow, backwardFlow} = edgeSummaries[i];
    const checkF = forwardFlow >= threshold;
    const checkB = backwardFlow >= threshold;
    if (checkF || checkB) {
      // The edge might be effectively unidrectional--in that case let's not
      // waste space storing data for the direction that had very little cred
      // flow.
      return {
        forwardFlow: checkF ? d.forwardFlow : null,
        backwardFlow: checkB ? d.backwardFlow : null,
      };
    }
    return null;
  });

  return {
    nodeOverTime: newNodeOverTime,
    edgeOverTime: newEdgeOverTime,
    nodeSummaries,
    edgeSummaries,
    intervals,
  };
}

/**
 * Keep Cred scores over time for nodes matching specified indices.
 *
 * Throw away all other over-time data.
 *
 * Very aggressive, but matches where we'll be at with initial CredRank.
 */
export function compressDownToMatchingIndices(
  x: CredData,
  inclusionIndices: Set<number>
): CredData {
  const {
    nodeSummaries,
    nodeOverTime,
    edgeSummaries,
    edgeOverTime,
    intervals,
  } = x;

  const newNodeOverTime = nodeOverTime.map((d, i) => {
    if (d == null) {
      // It might be null if the data was already compressed. The function
      // should be idempotent. This way we can chain compression strategies
      // later on.
      return null;
    }
    if (inclusionIndices.has(i)) {
      return {
        cred: d.cred,
        seedFlow: null,
        syntheticLoopFlow: null,
        dependencyMintedCred: null,
      };
    } else {
      return null;
    }
  });
  const newEdgeOverTime = edgeOverTime.map(() => null);
  return {
    nodeOverTime: newNodeOverTime,
    edgeOverTime: newEdgeOverTime,
    nodeSummaries,
    edgeSummaries,
    intervals,
  };
}
