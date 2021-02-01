// @flow

/**
 * Core logic for computing timeline PageRank on a graph.
 */
import deepFreeze from "deep-freeze";
import {sum} from "d3-array";
import * as NullUtil from "../../util/null";
import {
  Graph,
  type NodeAddressT,
  type EdgeAddressT,
  type Edge,
  type Node,
} from "../graph";
import {type WeightedGraph} from "../weightedGraph";
import {type NodeWeightsT} from "../weights/nodeWeights";
import {
  type Interval,
  partitionGraph,
  type IntervalSequence,
  intervalSequence,
} from "../interval";
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
  adjacencySource,
  type NodeToConnections,
} from "./graphToMarkovChain";
import {findStationaryDistribution, type PagerankParams} from "./markovChain";

export type IntervalResult = {|
  // The interval for this slice
  +interval: Interval,
  // The total node weight within this interval (normalized to account for the
  // exponential decay). We can use this to normalize the amount of cred
  // created in this interval.
  +intervalWeight: number,
  // The raw score distribution over nodes for this interval (i.e. sums to 1).
  // Uses the canonical graph node order.
  +distribution: Distribution,
  // For each edge, how much forward score flow there was (in terms of raw
  // probability mass). Uses the canonical graph edge order.
  +forwardFlow: Distribution,
  // For each edge, how much backward score flow there was (in terms of raw
  // probability mass). Uses the canonical graph edge order.
  +backwardFlow: Distribution,
  // For each node, how much score flowed along its synthetic self loop edge.
  +syntheticLoopFlow: Distribution,
  // For each node, how much score flowed to it from the seed vector.
  +seedFlow: Distribution,
  // Invariant: A node's score in the distribution is equal (modulo floating point error)
  // to the sum of:
  // - its seedFlow
  // - its syntheticLoopFlow
  // - the forwardFlow of each edge for which the node is the destination
  // - the backwardFlow of each edge for which the node is the source
|};
/**
 * Represents raw PageRank distributions on a graph over time.
 */
export type TimelineDistributions = $ReadOnlyArray<IntervalResult>;

export const SYNTHETIC_LOOP_WEIGHT = 1e-3;

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
  const nodeEvaluator = nodeWeightEvaluator(weightedGraph.weights.nodeWeightsT);
  const edgeEvaluator = edgeWeightEvaluator(weightedGraph.weights.edgeWeightsT);

  const graphPartitionSlices = partitionGraph(weightedGraph.graph);
  if (graphPartitionSlices.length === 0) {
    return [];
  }
  const intervals = intervalSequence(
    graphPartitionSlices.map((x) => x.interval)
  );
  const nodeCreationHistory = graphPartitionSlices.map((x) => x.nodes);
  const edgeCreationHistory = graphPartitionSlices.map((x) => x.edges);
  const nodeOrder = Array.from(weightedGraph.graph.nodes()).map(
    (x) => x.address
  );
  const edgeOrder = Array.from(
    weightedGraph.graph.edges({showDangling: false})
  ).map((x) => x.address);
  const nodeWeightIterator = _timelineNodeWeights(
    nodeCreationHistory,
    nodeEvaluator,
    intervalDecay
  );
  const nodeToConnectionsIterator = _timelineNodeToConnections(
    weightedGraph.graph,
    edgeCreationHistory,
    edgeEvaluator,
    intervalDecay
  );
  return _computeTimelineDistribution(
    nodeOrder,
    edgeOrder,
    intervals,
    nodeWeightIterator,
    nodeToConnectionsIterator,
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
    const nodeWeightsT = new Map();
    // Decay all the previous weights.
    for (const [address, weight] of lastNodeWeights.entries()) {
      nodeWeightsT.set(address, weight * intervalDecay);
    }
    // Add new nodes at full weight.
    for (const {address} of nodes) {
      // Normalize by (1 - intervalDecay) so that the total weight of a node across
      // intervals converges to the full base weight
      const normalizedWeight = nodeEvaluator(address) * (1 - intervalDecay);
      nodeWeightsT.set(address, normalizedWeight);
    }
    yield nodeWeightsT;
    lastNodeWeights = nodeWeightsT;
  }
}

export function* _timelineNodeToConnections(
  graph: Graph,
  edgeCreationHistory: $ReadOnlyArray<$ReadOnlyArray<Edge>>,
  edgeEvaluator: EdgeWeightEvaluator,
  intervalDecay: number
): Iterator<NodeToConnections> {
  const edgeWeightsT = new Map();
  for (const edges of edgeCreationHistory) {
    for (const [address, {forwards, backwards}] of edgeWeightsT.entries()) {
      edgeWeightsT.set(address, {
        forwards: forwards * intervalDecay,
        backwards: backwards * intervalDecay,
      });
    }
    for (const {address} of edges) {
      edgeWeightsT.set(address, edgeEvaluator(address));
    }
    const defaultEdgeWeight = deepFreeze({forwards: 0, backwards: 0});
    const currentEdgeWeight = (e: Edge) => {
      return NullUtil.orElse(edgeWeightsT.get(e.address), defaultEdgeWeight);
    };
    yield createConnections(graph, currentEdgeWeight, SYNTHETIC_LOOP_WEIGHT);
  }
}

// Warning: This function is untested.
// Modify with care.
export async function _computeTimelineDistribution(
  nodeOrder: $ReadOnlyArray<NodeAddressT>,
  edgeOrder: $ReadOnlyArray<EdgeAddressT>,
  intervals: IntervalSequence,
  nodeWeightIterator: Iterator<Map<NodeAddressT, number>>,
  nodeToConnectionsIterator: Iterator<NodeToConnections>,
  alpha: number
): Promise<TimelineDistributions> {
  const results = [];
  let pi0: Distribution | null = null;

  for (const interval of intervals) {
    const nodeWeightsT = NullUtil.get(nodeWeightIterator.next().value);
    const nodeToConnections = NullUtil.get(
      nodeToConnectionsIterator.next().value
    );
    const result = await _intervalResult(
      nodeWeightsT,
      nodeToConnections,
      nodeOrder,
      edgeOrder,
      interval,
      pi0,
      alpha
    );
    results.push(result);
    // Use the latest convergce results as the starting point for the next run
    // of PageRank
    pi0 = result.distribution;
  }
  return results;
}

export async function _intervalResult(
  nodeWeightsT: NodeWeightsT,
  nodeToConnections: NodeToConnections,
  nodeOrder: $ReadOnlyArray<NodeAddressT>,
  edgeOrder: $ReadOnlyArray<EdgeAddressT>,
  interval: Interval,
  pi0: Distribution | null,
  alpha: number
): Promise<IntervalResult> {
  const {chain} = createOrderedSparseMarkovChain(nodeToConnections);
  const nodeToIndex = new Map(nodeOrder.map((x, i) => [x, i]));
  const edgeToIndex = new Map(edgeOrder.map((x, i) => [x, i]));

  const seed = weightedDistribution(nodeOrder, nodeWeightsT);
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
  const intervalWeight = sum(nodeWeightsT.values());
  const forwardFlow = new Float64Array(edgeOrder.length);
  const backwardFlow = new Float64Array(edgeOrder.length);
  const syntheticLoopFlow = new Float64Array(nodeOrder.length);
  const seedFlow = seed.map((x) => x * alpha);

  for (const [target, connections] of nodeToConnections.entries()) {
    for (const {adjacency, weight} of connections) {
      // We now iterate over every "adjacency" in the markov chain. Every edge corresponds to
      // two adjacencies (one forward, one backward), and every synthetic loop also corresponds
      // to one adjacency.
      // The adjacencies are used to construct the underling Markov Chain, and crucially their
      // "weights" are normalized probabilities rather than raw pre-normalized weights. This means
      // we can now calculate the exact amount of score that flowed along each adjacency.
      // The score flow on an adjacency is equal to (1-alpha) * (sourceScore * adjacencyWeight),
      // where sourceScore is the score of the node that is the "source" of that adjacency (the
      // src for an IN_EDGE adjacency, the dst for an OUT_EDGE adjacency, or the node itself
      // for a synthetic loop adjacency). Since the sum of the outbound weights for any source
      // is `1`, we have an invariant that the total outbound score flow for any node is that node's
      // score times (1-alpha), which satisfies the PageRank property.
      const source = adjacencySource(target, adjacency);
      const sourceIndex = NullUtil.get(nodeToIndex.get(source));
      const contribution =
        weight * distributionResult.pi[sourceIndex] * (1 - alpha);
      switch (adjacency.type) {
        case "SYNTHETIC_LOOP": {
          syntheticLoopFlow[sourceIndex] = contribution;
          break;
        }
        case "IN_EDGE": {
          // IN_EDGE from the perspective of the target, i.e. it's forward flow
          const edgeIndex = NullUtil.get(
            edgeToIndex.get(adjacency.edge.address)
          );
          forwardFlow[edgeIndex] = contribution;
          break;
        }
        case "OUT_EDGE": {
          // OUT_EDGE from the perspective of the target, i.e. it's backwards flow
          const edgeIndex = NullUtil.get(
            edgeToIndex.get(adjacency.edge.address)
          );
          backwardFlow[edgeIndex] = contribution;
          break;
        }
        default: {
          throw new Error((adjacency.type: empty));
        }
      }
    }
  }
  return {
    interval,
    intervalWeight,
    distribution: distributionResult.pi,
    forwardFlow,
    backwardFlow,
    syntheticLoopFlow,
    seedFlow,
  };
}
