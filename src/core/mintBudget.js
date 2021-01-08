// @flow

import {sum} from "d3-array";
import findLast from "lodash.findlast";
import * as NullUtil from "../util/null";
import * as Weights from "./weights";
import * as C from "../util/combo";
import {type NodeAddressT, NodeAddress} from "./graph";
import {type WeightedGraph as WeightedGraphT} from "./weightedGraph";
import {
  nodeWeightEvaluator,
  type NodeWeightEvaluator,
} from "./algorithm/weightEvaluator";
import {partitionGraph, type GraphIntervalPartition} from "./interval";
import type {TimestampMs} from "../util/timestamp";

/**
 * This module adds logic for imposing a Cred minting budget on a graph.
 *
 * Basically, we allow specifiying a budget where nodes matching a particular
 * address may mint at most a fixed amount of Cred per period. Since every
 * plugin writes nodes with a distinct prefix, this may be used to specify
 * plugin-level Cred budgets. The same mechanism could also be used to
 * implement more finely-grained budgets, e.g. for specific node types.
 */

export type IntervalLength = "WEEKLY";

export const intervalLengthParser: C.Parser<IntervalLength> = C.exactly([
  "WEEKLY",
]);

export type BudgetPeriod = {|
  // When this budget policy starts
  +startTimeMs: TimestampMs,
  // How much Cred can be minted per interval
  +budgetValue: number,
|};

export type BudgetEntry = {|
  +prefix: NodeAddressT,
  +periods: $ReadOnlyArray<BudgetPeriod>,
|};

export type Budget = {|
  +entries: $ReadOnlyArray<BudgetEntry>,
  +intervalLength: IntervalLength,
|};

/**
 * Given a WeightedGraph and a budget, return a new WeightedGraph which ensures
 * that the budget constraint is satisfied.
 *
 * Concretely, this means that the weights in the Graph may be reduced, as
 * necessary, in order to bring the total minted Cred within an interval down
 * to the budget's requirements.
 */
export function applyBudget(
  wg: WeightedGraphT,
  budget: Budget
): WeightedGraphT {
  // It'd be really nice to support the case where some budgets are subsets of
  // other budgets. As an example, imagine saying: The GitHub plugin can mint
  // at most 1000 Cred per week, and within that, this particular GitHub repo
  // can mint at most 200, that one can mint at most 400, etc. However, I
  // didn't want to figure out the math for solving those constraints just yet,
  // since the initial use case of limiting minting per plugin doesn't need to
  // worry about intersections between the budgets.
  //
  // So let's just throw an error if there are any overlapping prefixes for
  // now, and we can improve the implementation later once we want to do more
  // sophisticated budget policies.
  if (_anyCommonPrefixes(budget.entries.map((x) => x.prefix))) {
    throw new Error(`budget prefix conflict detected`);
  }
  if (budget.intervalLength !== "WEEKLY") {
    throw new Error(`non-weekly budgets not supported`);
  }

  const reweighting = _computeReweighting(wg, budget);
  return _reweightGraph(wg, reweighting);
}

export type AddressWeight = {|+address: NodeAddressT, +weight: number|};

// Interpreted as an array of mutiplicative weight changes,
// i.e. for each AddressWeight, the node at the address
// should be re-weighted by the corresponding weight
export type Reweighting = $ReadOnlyArray<AddressWeight>;

/**
 * Given the WeightedGraph and the Budget, returns an array of every {addres,
 * weight} pair where the address needs to be re-weighted in order to satisfy
 * the budget constraint.
 */
export function _computeReweighting(
  wg: WeightedGraphT,
  budget: Budget
): Reweighting {
  const evaluator = nodeWeightEvaluator(wg.weights);
  const partition = partitionGraph(wg.graph);
  const reweightingsForEachBudget: $ReadOnlyArray<Reweighting> = budget.entries.map(
    (entry) => _reweightingForEntry({evaluator, partition, entry})
  );
  return reweightingsForEachBudget.flat();
}

/**
 * Given a the time-partitioned graph, the weight evaluator, and a particular
 * entry for the budget, return every {address, weight} pair where the
 * corresponding address needs to be reweighted in order to satisfy this budget
 * entry.
 */
export function _reweightingForEntry(args: {
  evaluator: NodeWeightEvaluator,
  partition: GraphIntervalPartition,
  entry: BudgetEntry,
}): Reweighting {
  const {evaluator, partition, entry} = args;
  const {periods, prefix} = entry;

  // Check that the budget's periods are in time-sorted order.
  if (!inSortedOrder(periods.map((x) => x.startTimeMs))) {
    throw new Error(
      `budget for ${NodeAddress.toString(prefix)} has periods out-of-order`
    );
  }

  const results = [];
  for (const {interval, nodes} of partition) {
    const budgetValue = _findCurrentBudgetValue(periods, interval.startTimeMs);
    const addresses = nodes.map((n) => n.address);
    const filteredAddresses = addresses.filter((a) =>
      NodeAddress.hasPrefix(a, prefix)
    );
    const addressWeights = filteredAddresses.map((a) => ({
      address: a,
      weight: evaluator(a),
    }));
    const normalizer = _computeWeightNormalizer(addressWeights, budgetValue);
    // If the normalizer is exactly 1, no re-weighting is necessary.
    if (normalizer !== 1) {
      // Re-weight every address matching this budget entry
      // equally.
      for (const address of filteredAddresses) {
        results.push({address, weight: normalizer});
      }
    }
  }
  return results;
}

/**
 * Given a WeightedGraph and the reweighting, return a new WeightedGraph which
 * has had its weights updated accordingly, without mutating the original
 * WeightedGraph.
 */
export function _reweightGraph(
  wg: WeightedGraphT,
  reweighting: Reweighting
): WeightedGraphT {
  const newWeights = Weights.copy(wg.weights);
  for (const {address, weight} of reweighting) {
    const existingWeight = NullUtil.orElse(
      wg.weights.nodeWeights.get(address),
      1
    );
    newWeights.nodeWeights.set(address, existingWeight * weight);
  }

  return {graph: wg.graph.copy(), weights: newWeights};
}

/**
 * Given an array of node addresses, return true if any node address is a prefix
 * of another address.
 *
 * This method runs in O(n^2). This should be fine because it's intended to be
 * run on small arrays (~one per plugin). If this becomes a performance
 * hotpsot, we can write a more performant version.
 */
export function _anyCommonPrefixes(
  addresses: $ReadOnlyArray<NodeAddressT>
): boolean {
  for (let i = 0; i < addresses.length; i++) {
    for (let j = i; j < addresses.length; j++) {
      if (i === j) {
        continue;
      }
      // Check both if A is prefix of B and if B is prefix of A
      // (not symmetrical)
      if (NodeAddress.hasPrefix(addresses[i], addresses[j])) {
        return true;
      }
      if (NodeAddress.hasPrefix(addresses[j], addresses[i])) {
        return true;
      }
    }
  }
  return false;
}

function inSortedOrder(xs: $ReadOnlyArray<number>): boolean {
  let last = -Infinity;
  for (const x of xs) {
    if (x < last) {
      return false;
    }
    last = x;
  }
  return true;
}

// Given an array of periods, and a timestamp, choose the last period whose
// startTimeMs is <= the timestamp, and then return its budget. Returns
// Infinity if there is no matching budget.
export function _findCurrentBudgetValue(
  periods: $ReadOnlyArray<BudgetPeriod>,
  timestamp: TimestampMs
): number {
  const currentPeriod = findLast(
    periods,
    (period) => period.startTimeMs <= timestamp
  );
  return currentPeriod ? currentPeriod.budgetValue : Infinity;
}

// For the given array of AddressWeights, and a budget that they must fit within, return
// a normalization coefficient which can be used to reweight all of these AddressWeights
// so that they fit within the budget. Will be a number in the range [0, 1], where 0
// implies the budget is 0 (so everything gets set to 0) and 1 implies the AddressWeights
// are already fitting within the budget.
export function _computeWeightNormalizer(
  aws: $ReadOnlyArray<AddressWeight>,
  budgetValue: number
): number {
  const totalWeight = sum(aws, (aw) => aw.weight);
  if (totalWeight <= budgetValue) {
    return 1;
  } else {
    return budgetValue / totalWeight;
  }
}
