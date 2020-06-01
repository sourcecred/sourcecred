// @flow

import type {TimestampMs} from "../util/timestamp";
import type {TimelineCredScores} from "../core/algorithm/distributionToCred";

/**
 * Comprehensive data on a cred distribution.
 */
export type CredData = {|
  // Cred level information, always stored in graph address order.
  +nodeSummaries: $ReadOnlyArray<NodeCredSummary>,
  +nodeOverTime: $ReadOnlyArray<NodeCredOverTime | null>,
  +edgeSummaries: $ReadOnlyArray<EdgeCredSummary>,
  +edgeOverTime: $ReadOnlyArray<EdgeCredOverTime | null>,
  +intervalEnds: $ReadOnlyArray<TimestampMs>,
|};

/** Summary of a node's cred across all time.
 *
 * CredData includes this information for every node in the graph, regardless of its score.
 */
export type NodeCredSummary = {|
  +cred: number,
  +seedFlow: number,
  +syntheticLoopFlow: number,
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

export function computeCredData(scores: TimelineCredScores): CredData {
  const numIntervals = scores.length;
  if (numIntervals === 0) {
    return {
      nodeSummaries: [],
      nodeOverTime: [],
      edgeSummaries: [],
      edgeOverTime: [],
      intervalEnds: [],
    };
  }
  const intervalEnds = scores.map((x) => x.interval.endTimeMs);
  const numNodes = scores[0].cred.length;
  const numEdges = scores[0].forwardFlow.length;
  const nodeSummaries = new Array(numNodes).fill(null).map(() => ({
    cred: 0,
    seedFlow: 0,
    syntheticLoopFlow: 0,
  }));
  const nodeOverTime = new Array(numNodes).fill(null).map(() => ({
    cred: new Array(numIntervals),
    seedFlow: new Array(numIntervals),
    syntheticLoopFlow: new Array(numIntervals),
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
    for (let n = 0; n < numNodes; n++) {
      nodeSummaries[n].cred += cred[n];
      nodeOverTime[n].cred[i] = cred[n];
      nodeSummaries[n].seedFlow += seedFlow[n];
      nodeOverTime[n].seedFlow[i] = seedFlow[n];
      nodeSummaries[n].syntheticLoopFlow += syntheticLoopFlow[n];
      nodeOverTime[n].syntheticLoopFlow[i] = syntheticLoopFlow[n];
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
    intervalEnds,
  };
}
