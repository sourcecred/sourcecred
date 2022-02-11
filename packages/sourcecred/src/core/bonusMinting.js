// @flow

/**
 * This module adds a system for specifying "bonus minting" policies. The core
 * idea for bonus minting is that extra Cred is conjured out of thin air (as a
 * "bonus") and distributed to a chosen recipient. This system is intended to
 * be used for minting Cred for project-level dependencies. For example, we
 * would like users of SourceCred to mint some extra Cred and flow it to the
 * SourceCred project.
 *
 * In CredRank, we handle this by creating extra nodes in the graph which mint
 * the bonus Cred, and it flows directly from those nodes to the intended
 * recipients.
 *
 * The total amount of Cred that may be minted is unbounded; for example, if
 * the dependencies have a total weight of 0.2, then the total Cred will be
 * 120% of the base Cred, but if the dependencies had a total weight of 1, then
 * the total Cred would be double the base Cred. This was a deliberate design
 * decision so that dependency minting would feel "non-rival", i.e. there is
 * not a fixed budget of dependency cred that must be split between the
 * dependencies. In some cases, it may be reasonable for the total Cred flowing
 * to a project's dependencies to be larger than the total Cred flowing
 * directly to the project's contributors; consider that the total amount of
 * time/effort invested in building all the dependencies may be orders of
 * magnitude larger than investment in the project itself.
 */
import {
  type NodeAddressT,
  NodeAddress,
  type Node as GraphNode,
  type Edge as GraphEdge,
  type EdgeAddressT,
  EdgeAddress,
  Graph,
} from "./graph";
import {type WeightedGraph as WeightedGraphT} from "./weightedGraph";
import {empty as emptyWeights, type EdgeWeight} from "./weights";
import {type TimestampMs} from "../util/timestamp";
import {type IntervalSequence, type Interval, partitionGraph} from "./interval";
import {nodeWeightEvaluator} from "./algorithm/weightEvaluator";

export type BonusPolicy = {|
  // The node address that will receieve the extra minted Cred
  +address: NodeAddressT,
  // Information on how the Cred minting weight varies in time.
  +periods: $ReadOnlyArray<BonusPeriod>,
|};

export type BonusPeriod = {|
  // What proportion of the project's raw Cred should be minted to this
  // dependency during this period. For example, if the weight is 0.05, and the
  // project has a pre-dependencies total Cred of 1000 in a given interval,
  // then this dependency will receive an additional 50 Cred.
  +weight: number,
  // Timestamp or number because we allow -Infinity as the first "timestamp"
  // Within any policy, the period timestamps must be in sorted order, or else
  // an error will be thrown.
  +startTimeMs: TimestampMs | number,
|};

export type ComputedBonusMinting = $ReadOnlyArray<BonusMintOverTime>;

export type BonusMintOverTime = {|
  +recipient: GraphNode,
  // Recipient's bonus minting in each interval.
  +bonusIntervals: $ReadOnlyArray<BonusInterval>,
|};

export type BonusInterval = {|
  +interval: Interval,
  // The amount of bonus Cred to mint in this interval.
  +amount: number,
|};

export function computeBonusMinting(
  wg: WeightedGraphT,
  policies: $ReadOnlyArray<BonusPolicy>
): ComputedBonusMinting {
  const mintIntervals = _computeMintIntervals(wg);
  return policies.map((policy) => {
    const recipient = wg.graph.node(policy.address);
    if (recipient == null) {
      throw new Error(
        `bonus recipient not in graph: ${NodeAddress.toString(policy.address)}`
      );
    }
    return {
      recipient,
      bonusIntervals: bonusIntervals(mintIntervals, policy.periods),
    };
  });
}

export function computeBonusMintingByIntervals(
  mintIntervals: $ReadOnlyArray<MintInterval>,
  policies: $ReadOnlyArray<BonusPolicy>
): $ReadOnlyArray<{|
  +recipient: NodeAddressT,
  +bonusIntervals: $ReadOnlyArray<BonusInterval>,
|}> {
  return policies.map((policy) => {
    return {
      recipient: policy.address,
      bonusIntervals: bonusIntervals(mintIntervals, policy.periods),
    };
  });
}

export function bonusIntervals(
  mintIntervals: $ReadOnlyArray<MintInterval>,
  periods: $ReadOnlyArray<BonusPeriod>
): $ReadOnlyArray<BonusInterval> {
  let nextIndex = 0;
  let weight = 0;

  return mintIntervals.map(({interval, totalMint}) => {
    while (
      nextIndex < periods.length &&
      periods[nextIndex].startTimeMs <= interval.startTimeMs
    ) {
      weight = periods[nextIndex].weight;
      nextIndex++;
    }
    return {
      interval,
      amount: totalMint * weight,
    };
  });
}

export function createBonusGraph(
  bonusMints: ComputedBonusMinting
): WeightedGraphT {
  const graph = new Graph();
  const weights = emptyWeights();
  for (const {recipient, bonusIntervals} of bonusMints) {
    graph.addNode(recipient);
    for (const {interval, amount} of bonusIntervals) {
      if (amount === 0) {
        continue;
      }
      graph.addNode(bonusNode(recipient, interval));
      graph.addEdge(bonusEdge(recipient, interval));
      weights.nodeWeights.set(bonusNodeAddress(recipient, interval), amount);
    }
  }
  weights.edgeWeights.set(BONUS_EDGE_PREFIX, BONUS_EDGE_WEIGHT);
  return {graph, weights};
}

export const BONUS_NODE_PREFIX: NodeAddressT = NodeAddress.fromParts([
  "sourcecred",
  "core",
  "BONUS",
]);

export function bonusNodeAddress(
  recipient: GraphNode,
  interval: Interval
): NodeAddressT {
  return NodeAddress.append(
    BONUS_NODE_PREFIX,
    String(interval.startTimeMs),
    ...NodeAddress.toParts(recipient.address)
  );
}

export function bonusNode(recipient: GraphNode, interval: Interval): GraphNode {
  return {
    address: bonusNodeAddress(recipient, interval),
    timestampMs: interval.startTimeMs,
    description: `bonus minting for ${recipient.description} starting ${interval.startTimeMs}`,
  };
}

export const BONUS_EDGE_PREFIX: EdgeAddressT = EdgeAddress.fromParts([
  "sourcecred",
  "core",
  "BONUS",
]);

export const BONUS_EDGE_WEIGHT: EdgeWeight = Object.freeze({
  forwards: 1,
  // setting the backward weight to non-zero has a material effect on the
  // resultant Cred scores, since it means that the bonus minting node acts as
  // a mini Cred accumulator in a tight loop with the recipient. Setting this
  // to 0 results in somewhat lower Cred for the mint recipient, and I like
  // biasing conservatively here.
  backwards: 0,
});

export function bonusEdgeAddress(
  recipient: GraphNode,
  interval: Interval
): EdgeAddressT {
  return EdgeAddress.append(
    BONUS_EDGE_PREFIX,
    String(interval.startTimeMs),
    ...NodeAddress.toParts(recipient.address)
  );
}

export function bonusEdge(recipient: GraphNode, interval: Interval): GraphEdge {
  return {
    src: bonusNodeAddress(recipient, interval),
    dst: recipient.address,
    address: bonusEdgeAddress(recipient, interval),
    timestampMs: interval.startTimeMs,
  };
}

// How much total Cred minting occured in a particular interval, for a particular graph?
export type MintInterval = {|
  +interval: Interval,
  +totalMint: number,
|};
export function _computeMintIntervals(
  wg: WeightedGraphT
): $ReadOnlyArray<MintInterval> {
  const nwe = nodeWeightEvaluator(wg.weights);
  const partition = partitionGraph(wg.graph);
  return partition.map(({interval, nodes}) => {
    let totalMint = 0;
    for (const {address} of nodes) {
      totalMint += nwe(address);
    }
    return {interval, totalMint};
  });
}

// ========================= DEPRECATED =========================
// Everything below this line has TimelineCred specific logic, and will be
// removed when we switch to CredRank.

/**
 * The ProcessedBonusPolicy is a BonusPolicy which has
 * been transformed so that it matches the abstractions available when
 * we're doing raw cred computation: instead of an address, we track an index
 * into the canonical node order, and rather than arbitrary client-provided
 * periods, we compute the weight for each Interval.
 *
 * TODO(#1686, @decentralion): Remove this once we switch to CredRank.
 */
export type ProcessedBonusPolicy = {|
  +nodeIndex: number,
  +intervalWeights: $ReadOnlyArray<number>,
|};

export function processBonusPolicy(
  policy: BonusPolicy,
  nodeOrder: $ReadOnlyArray<NodeAddressT>,
  intervals: IntervalSequence
): ProcessedBonusPolicy {
  const {address, periods} = policy;
  const nodeIndex = nodeOrder.indexOf(address);
  if (nodeIndex === -1) {
    throw new Error(
      `address not in nodeOrder: ${NodeAddress.toString(address)}`
    );
  }
  const intervalStarts = intervals.map((i) => i.startTimeMs);
  const intervalWeights = _alignPeriodsToIntervals(periods, intervalStarts);
  return {nodeIndex, intervalWeights};
}

export function _alignPeriodsToIntervals(
  periods: $ReadOnlyArray<BonusPeriod>,
  intervalStarts: $ReadOnlyArray<TimestampMs>
): $ReadOnlyArray<number> {
  if (periods.length === 0) {
    return intervalStarts.map(() => 0);
  }
  // Validate the periods to make sure they are in order and the weights
  // are finite and non-negative
  let currentStartTimeMs = periods[0].startTimeMs;
  for (const {startTimeMs, weight} of periods) {
    if (currentStartTimeMs > startTimeMs) {
      throw new Error(
        `mint periods out of order: ${currentStartTimeMs} > ${startTimeMs}`
      );
    }
    currentStartTimeMs = startTimeMs;
    if (weight < 0 || !Number.isFinite(weight)) {
      throw new Error(`invalid mint weight: ${weight}`);
    }
  }
  let currentPeriodIndex = -1;
  let currentWeight = 0;
  // We always return the weight of the latest period whose startTimeMs was
  // less than or equal to the interval's start.
  return intervalStarts.map((s) => {
    while (
      currentPeriodIndex < periods.length - 1 &&
      periods[currentPeriodIndex + 1].startTimeMs <= s
    ) {
      currentPeriodIndex++;
      currentWeight = periods[currentPeriodIndex].weight;
    }
    return currentWeight;
  });
}
