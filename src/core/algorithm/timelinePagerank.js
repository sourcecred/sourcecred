// @flow

/**
 * Core logic for computing timeline PageRank on a graph.
 */
import deepFreeze from "deep-freeze";
import {sum} from "d3-array";
import * as NullUtil from "../../util/null";
import {Graph, type NodeAddressT, type Edge, type Node} from "../graph";
import {type WeightedGraph} from "../weightedGraph";
import {type Interval, partitionGraph} from "../interval";
import {
  nodeWeightEvaluator,
  edgeWeightEvaluator,
  type NodeWeightEvaluator,
  type EdgeWeightEvaluator,
} from "./weightEvaluator";
import {weightedDistribution} from "./nodeDistribution";
import {type Distribution} from "./distribution";
import {
  createOrderedSparseMarkovChain,
  createConnections,
} from "./graphToMarkovChain";
import {
  findStationaryDistribution,
  type PagerankParams,
  type SparseMarkovChain,
} from "./markovChain";

/**
 * Represents raw PageRank distributions on a graph over time.
 */
export type TimelineDistributions = $ReadOnlyArray<{|
  // The interval for this slice
  +interval: Interval,
  // The total node weight within this interval (normalized to account for the
  // exponential decay). We can use this to normalize the amount of cred
  // created in this interval.
  +intervalWeight: number,
  // The raw score distribution over nodes for this interval (i.e. sums to 1).
  // Uses the canonical graph node order.
  +distribution: Distribution,
|}>;

/**
 * Runs timeline PageRank on a graph.
 *
 * The graph is partitioned into weeklong intervals. For each interval, we run
 * PageRank, assigning seed weight to nodes which have already been created,
 * and considering edges which have already been created. Node weights and edge
 * weights both decay by the `intervalDecay` every week.
 *
 * Detailed description:
 *
 * First, we partition the graph into week-long intervals using the `interval`
 * module. For each such interval, we will produce a score distribution over
 * all the nodes in the graph, and a total weight for the interval, based on
 * the decayed weights of all the nodes that had been created as of that
 * interval.
 *
 * To get the score distribution, we create a node weight map for each
 * interval, and a markov chain for each interval.
 *
 * In the node weight map, every node is initially assigned full weight in the
 * interval of its creation, and in every interval thereafter its weight decays
 * by `intervalDecay`. However, note that the 'full weight' is normalized based
 * on the interval decay. To make this concrete, suppose that we have an
 * interval decay of 0.5, and a node with a base weight of 8. We want the total
 * weight given to this node (across all intervals) to equal 8, so that
 * weight-based cred normalization will be independent of the interval decay.
 * So we give it a normalized weight of 4 in the first interval, 2 in the
 * second, and so forth.
 *
 * For each interval, we also create a markov chain which describes the graph
 * state as of that interval. That markov chain only contains weight for edges
 * which were already created as of the interval; any edges that are not yet
 * created effectively have a weight of 0. Like the node weights, edge weights
 * are created with full weight, and then decay by `intervalDecay` each
 * interval. Unlike the node weights, we don't need to normalize based on
 * intervalDecay, since markov chains always normalize the edge weights.
 *
 * Given the markov chain and node weights for the interval, we compute the
 * score distribution by running finding the stationary distribution for that
 * markov chain, using the node weights as the seed vector. As ever, the
 * `alpha` parameter determines how much probability mass returns to the seed
 * vector. (See the docs in markovChain.js for more details.) The score
 * distribution uses the Graph's canonical node ordering.
 *
 * The output array contains an element for each interval in the graph
 * partitioning. Each element contains the interval, the distribution, as well
 * as the sum of all node weights for that interval (so that we can normalize
 * cred).
 *
 * The method is factored apart into a wrapper function which does validation,
 * and iterators that produce the node weights and the markov chains. This
 * facilitates testing the timelime logic separately. Finally, we compose all
 * the pieces and run PageRank for each interval.
 */
export async function timelinePagerank(
  weightedGraph: WeightedGraph,
  intervalDecay: number,
  alpha: number
): Promise<TimelineDistributions> {
  if (intervalDecay < 0 || intervalDecay > 1 || !isFinite(intervalDecay)) {
    throw new Error(`invalid intervalDecay: ${intervalDecay}`);
  }
  if (alpha < 0 || alpha > 1 || !isFinite(alpha)) {
    throw new Error(`invalid alpha: ${alpha}`);
  }
  // Produce the evaluators we will use to get the baseline weight for each
  // node and edge
  const nodeEvaluator = nodeWeightEvaluator(weightedGraph.weights);
  const edgeEvaluator = edgeWeightEvaluator(weightedGraph.weights);

  const graphPartitionSlices = partitionGraph(weightedGraph.graph);
  if (graphPartitionSlices.length === 0) {
    return [];
  }
  const intervals = graphPartitionSlices.map((x) => x.interval);
  const nodeCreationHistory = graphPartitionSlices.map((x) => x.nodes);
  const edgeCreationHistory = graphPartitionSlices.map((x) => x.edges);
  const nodeOrder = Array.from(weightedGraph.graph.nodes()).map(
    (x) => x.address
  );
  const nodeWeightIterator = _timelineNodeWeights(
    nodeCreationHistory,
    nodeEvaluator,
    intervalDecay
  );
  const markovChainIterator = _timelineMarkovChain(
    weightedGraph.graph,
    edgeCreationHistory,
    edgeEvaluator,
    intervalDecay
  );
  return _computeTimelineDistribution(
    nodeOrder,
    intervals,
    nodeWeightIterator,
    markovChainIterator,
    alpha
  );
}

export function* _timelineNodeWeights(
  nodeCreationHistory: $ReadOnlyArray<$ReadOnlyArray<Node>>,
  nodeEvaluator: NodeWeightEvaluator,
  intervalDecay: number
): Iterator<Map<NodeAddressT, number>> {
  let lastNodeWeights = new Map();
  for (const nodes of nodeCreationHistory) {
    const nodeWeights = new Map();
    // Decay all the previous weights.
    for (const [address, weight] of lastNodeWeights.entries()) {
      nodeWeights.set(address, weight * intervalDecay);
    }
    // Add new nodes at full weight.
    for (const {address} of nodes) {
      // Normalize by (1 - intervalDecay) so that the total weight of a node across
      // intervals converges to the full base weight
      const normalizedWeight = nodeEvaluator(address) * (1 - intervalDecay);
      nodeWeights.set(address, normalizedWeight);
    }
    yield nodeWeights;
    lastNodeWeights = nodeWeights;
  }
}

export function* _timelineMarkovChain(
  graph: Graph,
  edgeCreationHistory: $ReadOnlyArray<$ReadOnlyArray<Edge>>,
  edgeEvaluator: EdgeWeightEvaluator,
  intervalDecay: number
): Iterator<SparseMarkovChain> {
  const edgeWeights = new Map();
  for (const edges of edgeCreationHistory) {
    for (const [address, {forwards, backwards}] of edgeWeights.entries()) {
      edgeWeights.set(address, {
        forwards: forwards * intervalDecay,
        backwards: backwards * intervalDecay,
      });
    }
    for (const {address} of edges) {
      edgeWeights.set(address, edgeEvaluator(address));
    }
    const defaultEdgeWeight = deepFreeze({forwards: 0, backwards: 0});
    const currentEdgeWeight = (e: Edge) => {
      return NullUtil.orElse(edgeWeights.get(e.address), defaultEdgeWeight);
    };
    // Construct a new Markov chain corresponding to the current weights
    // of the edges.
    // TODO: Rather than constructing a markov chain from scratch, we can
    // update the markov chain in-place. This should result in a significant
    // performance improvement. We will need to change the markov chain
    // representation to do so (we should add a `totalOutWeight` array to the
    // chain, so that we can efficiently update the total weight as we add new
    // connections, rather than needing to re-normalize the whole chain for
    // each interval).
    const chain = createOrderedSparseMarkovChain(
      createConnections(graph, currentEdgeWeight, 1e-3)
    ).chain;
    yield chain;
  }
}

// Warning: This function is untested.
// Modify with care.
export async function _computeTimelineDistribution(
  nodeOrder: $ReadOnlyArray<NodeAddressT>,
  intervals: $ReadOnlyArray<Interval>,
  nodeWeightIterator: Iterator<Map<NodeAddressT, number>>,
  markovChainIterator: Iterator<SparseMarkovChain>,
  alpha: number
): Promise<TimelineDistributions> {
  const results = [];
  let pi0: Distribution | null = null;
  for (const interval of intervals) {
    const nodeWeights = NullUtil.get(nodeWeightIterator.next().value);
    const chain = NullUtil.get(markovChainIterator.next().value);

    const seed = weightedDistribution(nodeOrder, nodeWeights);
    if (pi0 == null) {
      pi0 = seed;
    }
    const params: PagerankParams = {chain, alpha, seed, pi0};
    const distributionResult = await findStationaryDistribution(params, {
      verbose: false,
      convergenceThreshold: 1e-7,
      maxIterations: 255,
      yieldAfterMs: 30,
    });
    const intervalWeight = sum(nodeWeights.values());
    results.push({
      interval,
      intervalWeight,
      distribution: distributionResult.pi,
    });
    // Use the latest convergce results as the starting point for the next run
    // of PageRank
    pi0 = distributionResult.pi;
  }
  return results;
}
