// @flow

import deepEqual from "lodash.isequal";

import {toCompat, fromCompat, type Compatible} from "../util/compat";
import {
  Graph,
  type Edge,
  type EdgesOptions,
  type NodeAddressT,
  type EdgeAddressT,
  type GraphJSON,
  sortedEdgeAddressesFromJSON,
  sortedNodeAddressesFromJSON,
  NodeAddress,
  type NeighborsOptions,
} from "./graph";
import {
  distributionToNodeDistribution,
  createConnections,
  createOrderedSparseMarkovChain,
  type EdgeWeight,
} from "./attribution/graphToMarkovChain";
import {
  findStationaryDistribution,
  uniformDistribution,
} from "../core/attribution/markovChain";
import * as NullUtil from "../util/null";

export {Direction} from "./graph";
export type {DirectionT, NeighborsOptions} from "./graph";
export type {EdgeWeight} from "./attribution/graphToMarkovChain";
export type EdgeEvaluator = (Edge) => EdgeWeight;

export type ScoredNode = {|
  +node: NodeAddressT,
  +score: number,
|};

export type WeightedEdge = {|
  +edge: Edge,
  +weight: EdgeWeight,
|};

export type ScoredNeighbor = {|
  // The neighbor node, with its score
  +scoredNode: ScoredNode,
  // The edge connecting the target to its neighbor node, with its weight
  +weightedEdge: WeightedEdge,
  // How much score (in absolute terms) was provided to the target by
  // the neighbor node through this weightedEdge
  +scoreContribution: number,
|};

export opaque type PagerankGraphJSON = Compatible<{|
  +graphJSON: GraphJSON,
  // Score for every node, ordered by the sorted node address.
  +scores: $ReadOnlyArray<number>,
  // Weights for every edge, ordered by sorted edge address.
  // We could save the EdgeWeights directly rather than having separate
  // arrays for toWeights and froWeights, but this would lead to an inflated
  // JSON representation because we would be needlessly duplicating the keys
  // "toWeight" and "froWeight" themselves.
  +toWeights: $ReadOnlyArray<number>,
  +froWeights: $ReadOnlyArray<number>,
  +syntheticLoopWeight: number,
|}>;

/**
 * Options to control how PageRank runs and when it stops
 */
export type PagerankConvergenceOptions = {|
  // Maximum number of iterations before we give up on PageRank Convergence
  +maxIterations: number,
  // PageRank will stop running once the diff between the previous iteration
  // and the latest is less than this threshold
  +convergenceThreshold: number,
|};

export type PagerankConvergenceReport = {|
  // A quantitative measure of how close to convergence the final distribution was.
  // Ideally, this value should be near zero.
  // It shows the maximum absolute-valued change of any entry in the distribution
  // if one more Markov action is taken.
  +convergenceDelta: number,
|};

export const DEFAULT_SYNTHETIC_LOOP_WEIGHT = 1e-3;
export const DEFAULT_MAX_ITERATIONS = 255;
export const DEFAULT_CONVERGENCE_THRESHOLD = 1e-7;

const COMPAT_INFO = {type: "sourcecred/pagerankGraph", version: "0.1.0"};

/**
 * PagerankGraph is a wrapper over the Graph class, which adds
 * the ability to run PageRank to compute scores on the Graph.
 *
 * Every node in the underlying Graph is assigned a numerical score in
 * the range [0, 1]. Provided that there are any nodes, the sum of all
 * the scores will be 1 (i.e. the scores are a probability
 * distribution). The scores are assigned by the [PageRank] algorithm;
 * i.e. a node recieves score in proportion to the score of its
 * neighbors. When the PagerankGraph is first constructed, the scores
 * are initialized to a uniform distribution.
 *
 * [PageRank]: https://en.wikipedia.org/wiki/PageRank
 *
 * Every edge in the Graph is assigned an `EdgeWeight`, which includes a
 * `toWeight` (weight from the `src` to the `dst`) and a `froWeight`
 * (weight from the `dst` back to the `src`). Both `toWeight` and
 * `froWeight` must be nonnegative numbers. The weights influence how
 * score flows from node to node. For example, if the node `root` is
 * connected to `a` with a weight of `1` and to `b` with a weight of `2`,
 * then `b` will recieve twice as much score from `root` as `a` does.
 *
 * Every node in the PagerankGraph has an associated `score`. Provided
 * that the graph has at least one node, the scores are a probability
 * distribution over the nodes; i.e. every score is in the range [0,1]
 * and the scores sum to 1.
 *
 * This class is intended to closely mirror the Graph API so as to
 * present a consistent and familiar interface.
 *
 * At present, PagerankGraph does not support any modification to the
 * underlying Graph; doing so will invalidate PagerankGraph and cause
 * its methods to throw errors.
 */
export class PagerankGraph {
  // The Graph backing this PagerankGraph
  _graph: Graph;
  // The score for each Node in the Graph
  _scores: Map<NodeAddressT, number>;
  // The EdgeWeight for each Edge in the Graph
  _edgeWeights: Map<EdgeAddressT, EdgeWeight>;
  // Weight used to connect nodes to themselves, to avoid isolated
  // nodes.
  _syntheticLoopWeight: number;
  // Modification count of the underlying Graph. Used to determine
  // when this PageRankGraph is in an invalid state (due to changes
  // to the graph backing it).
  _graphModificationCount: number;
  // Sum of all outWeights for a node, including the synthetic weight
  _totalOutWeight: Map<NodeAddressT, number>;

  /**
   * Constructs a new PagerankGraph.
   *
   * Note that constructing a PagerankGraph around an empty graph is illegal,
   * as it is impossible to define a probability distribution over zero
   * nodes.
   */
  constructor(
    // The Graph backing this PagerankGraph. Must not be empty.
    graph: Graph,
    // Provides the initial EdgeWeight for every edge
    edgeEvaluator: EdgeEvaluator,
    // The weight we use to connect every node to itself
    // to ensure there are no isolated nodes. Defaults to
    // DEFAULT_SYNTHETIC_LOOP_WEIGHT.
    syntheticLoopWeight: ?number
  ): void {
    if (graph.equals(new Graph())) {
      throw new Error("Cannot construct PagerankGraph with empty graph.");
    }
    this._graph = graph;
    this._graphModificationCount = graph.modificationCount();
    this._syntheticLoopWeight = NullUtil.orElse(
      syntheticLoopWeight,
      DEFAULT_SYNTHETIC_LOOP_WEIGHT
    );
    if (this._syntheticLoopWeight <= 0) {
      throw new Error("syntheticLoopWeight must be > 0");
    }

    // Initialize scores to the uniform distribution over every node
    this._scores = new Map();
    this._totalOutWeight = new Map();
    const graphNodes = Array.from(this._graph.nodes());
    for (const node of graphNodes) {
      this._scores.set(node, 1 / graphNodes.length);
      this._totalOutWeight.set(node, this._syntheticLoopWeight);
    }

    this._edgeWeights = new Map();
    const addOutWeight = (node: NodeAddressT, weight: number) => {
      const previousWeight = NullUtil.get(this._totalOutWeight.get(node));
      const newWeight = previousWeight + weight;
      this._totalOutWeight.set(node, newWeight);
    };
    for (const edge of this._graph.edges()) {
      const weights = edgeEvaluator(edge);
      this._edgeWeights.set(edge.address, weights);
      addOutWeight(edge.src, weights.toWeight);
      addOutWeight(edge.dst, weights.froWeight);
    }
  }

  /**
   * Retrieves the Graph backing this PagerankGraph.
   */
  graph(): Graph {
    this._verifyGraphNotModified();
    return this._graph;
  }

  /**
   * Returns the PagerankGraph's synthetic loop weight.
   *
   * The synthetic loop weight simulates a "phantom loop" connecting
   * every node to itself. This ensures that every node has at least
   * one outgoing connection, so that the corresponding markov chain
   * used for PageRank is well-defined.
   *
   * In general, the synthetic loop weight should be quite small.
   * By default, we set it to 1e-3.
   */
  syntheticLoopWeight(): number {
    return this._syntheticLoopWeight;
  }

  *_nodesIterator(iterator: Iterator<NodeAddressT>): Iterator<ScoredNode> {
    for (const node of iterator) {
      const score = NullUtil.get(this._scores.get(node));
      yield {node, score};
    }
  }

  /**
   * Provides node and score for every node in the underlying graph.
   *
   * Optionally, provide a node prefix to return an iterator containing
   * only node/score objects whose nodes match the provided node prefix.
   * See Graph.nodes and Address.hasPrefix for details.
   */
  nodes(options?: {|+prefix: NodeAddressT|}): Iterator<ScoredNode> {
    this._verifyGraphNotModified();
    const iterator = this._graph.nodes(options);
    return this._nodesIterator(iterator);
  }

  /**
   * Retrieve a node from the graph, along with its score.
   *
   * TODO(#1020): Allow optional filtering, as in Graph.node.
   */
  node(x: NodeAddressT): ?ScoredNode {
    this._verifyGraphNotModified();
    const score = this._scores.get(x);
    if (score == null) {
      return null;
    } else {
      return {node: x, score};
    }
  }

  /**
   * Provides edge and weight for every edge in the underlying graph.
   *
   * Optionally, provide an EdgesOptions parameter to return an
   * iterator containing edges matching the EdgesOptions prefix
   * filter parameters. See Graph.edges for details.
   */
  edges(options?: EdgesOptions): Iterator<WeightedEdge> {
    this._verifyGraphNotModified();
    const iterator = this._graph.edges(options);
    return this._edgesIterator(iterator);
  }

  *_edgesIterator(iterator: Iterator<Edge>): Iterator<WeightedEdge> {
    for (const edge of iterator) {
      const weight = NullUtil.get(this._edgeWeights.get(edge.address));
      yield {edge, weight};
    }
  }

  /**
   * Provides the edge and weight for a particular edge, if present.
   *
   * TODO(#1020): Allow optional filtering, as in Graph.edge.
   */
  edge(a: EdgeAddressT): ?WeightedEdge {
    this._verifyGraphNotModified();
    const edge = this._graph.edge(a);
    if (edge != null) {
      const weight = NullUtil.get(this._edgeWeights.get(edge.address));
      return {edge, weight};
    }
    return null;
  }

  /**
   * Provides the total out weight for a node, i.e. every edge weight pointed
   * away from the node, plus the syntheticLoopWeight.
   *
   * The total out weight is needed to interpret the actual significance of any
   * particular edge's weight, as edge weights are normalized by the totalOutWeight
   * so that the normalized weights going out of a node always sum to 1.
   */
  totalOutWeight(node: NodeAddressT): number {
    this._verifyGraphNotModified();
    const weight = this._totalOutWeight.get(node);
    if (weight == null) {
      throw new Error(
        `Tried to get outWeight for non-existent node ${NodeAddress.toString(
          node
        )}`
      );
    }
    return weight;
  }

  /**
   * Provides the Neighbors to a target node, along with how those
   * neighbors contributed to the node's score.
   *
   * See the docs on `Graph.neighbors` for the semantics of what a `Neighbor`
   * is. This call augments the Neighbors from graph, so that for each neighbor
   * we also have the neighbor node's score, the EdgeWeight for the edge, and a
   * scoreContribution, which shows how much score was contributed to the
   * target node from that Neighbor.
   *
   * When the PagerankGraph is well-converged, it will be the case that a
   * node's score is equal to the score contribution from each neighbor plus
   * the synthetic loop's score contribution.
   *
   * When the PagerankGraph is not well-converged, the score contributions are
   * meaningless.
   */
  neighbors(
    target: NodeAddressT,
    options: NeighborsOptions
  ): Iterator<ScoredNeighbor> {
    this._verifyGraphNotModified();
    if (!this.graph().hasNode(target)) {
      throw new Error(
        `Tried to find neighbors of non-existent node ${NodeAddress.toString(
          target
        )}`
      );
    }
    return this._neighborsIterator(target, options);
  }

  *_neighborsIterator(
    target: NodeAddressT,
    options: NeighborsOptions
  ): Iterator<ScoredNeighbor> {
    const graphNeighbors = this.graph().neighbors(target, options);
    for (const {node, edge} of graphNeighbors) {
      const scoredNode = NullUtil.get(this.node(node));
      const weightedEdge = NullUtil.get(this.edge(edge.address));
      // We compute how much of target's score is attributable to the neighbor.
      // First, we find out how much edge weight there was from node to target,
      // based on whether it was an IN-edge or OUT-edge or loop.
      let relevantEdgeWeight = 0;
      if (edge.src === target) {
        relevantEdgeWeight += weightedEdge.weight.froWeight;
      }
      if (edge.dst === target) {
        relevantEdgeWeight += weightedEdge.weight.toWeight;
      }
      // We normalize this edge weight by the total outWeight for `node`.
      const normalizedEdgeWeight =
        relevantEdgeWeight / this.totalOutWeight(node);

      // Then we directly compute the score contribution
      const scoreContribution = scoredNode.score * normalizedEdgeWeight;
      yield {scoredNode, weightedEdge, scoreContribution};
    }
  }

  /**
   * Returns how much of a node's score came from its synthetic loop.
   * For most nodes, this should be near zero. However, if the node has no
   * outgoing edge edge weight (e.g. it is isolated), then this value
   * may be larger.
   *
   * The results of syntheticLoopScoreContribution are not meaningful if the
   * PagerankGraph is not converged.
   */
  syntheticLoopScoreContribution(node: NodeAddressT): number {
    this._verifyGraphNotModified();
    const scoredNode = this.node(node);
    if (scoredNode == null) {
      throw new Error(
        "Cannot get syntheticLoopScoreContribution for non-existent node"
      );
    }
    return (
      (scoredNode.score * this._syntheticLoopWeight) / this.totalOutWeight(node)
    );
  }

  /**
   * Asynchronously run PageRank to re-compute scores.
   *
   * Calling this method constructs a [Markov Chain] corresponding
   * to the underlying graph and its associated edge weights,
   * and then iteratively converges to the stationary distribution
   * of that chain, according to the [PageRank algorithm].
   *
   * [Markov Chain]: https://brilliant.org/wiki/markov-chains/
   * [PageRank algorithm]: https://en.wikipedia.org/wiki/PageRank
   *
   * The `PagerankConvergenceOptions` gives guidance on how to run
   * PageRank. PageRank will continue running until either
   * `options.maxIterations` has been exceeded, or until the largest
   * individual delta in a node's score between the present and previous
   * iteration is less than or equal to `options.convergenceThreshold`.
   *
   * TODO(#1020): Make `runPagerank` use the current nodes' scores as a
   * starting point for computation, rather than re-generating from
   * scratch every time `runPagerank` is called.
   */
  async runPagerank(
    options: PagerankConvergenceOptions
  ): Promise<PagerankConvergenceReport> {
    this._verifyGraphNotModified();
    const edgeEvaluator = (x: Edge) =>
      NullUtil.get(this._edgeWeights.get(x.address));
    const connections = createConnections(
      this._graph,
      edgeEvaluator,
      this._syntheticLoopWeight
    );
    const osmc = createOrderedSparseMarkovChain(connections);
    const alpha = 0;
    const seed = uniformDistribution(osmc.chain.length);
    const initialDistribution = uniformDistribution(osmc.chain.length);
    const distributionResult = await findStationaryDistribution(
      osmc.chain,
      seed,
      alpha,
      initialDistribution,
      {
        verbose: false,
        convergenceThreshold: options.convergenceThreshold,
        maxIterations: options.maxIterations,
        yieldAfterMs: 30,
      }
    );
    this._scores = distributionToNodeDistribution(
      osmc.nodeOrder,
      distributionResult.pi
    );
    return {
      convergenceDelta: distributionResult.convergenceDelta,
    };
  }

  /**
   * Returns whether another PagerankGraph is equal to this one.
   *
   * PagerankGraphs are considered equal if they have the same nodes with
   * the same scores, and the same edges with the same weights, and the same
   * syntheticLoopWeight.
   *
   * The modification history of the underlying Graph is irrelevant to
   * equality.
   */
  equals(that: PagerankGraph): boolean {
    if (!(that instanceof PagerankGraph)) {
      throw new Error(`Expected PagerankGraph, got ${String(that)}`);
    }
    this._verifyGraphNotModified();
    return (
      this.graph().equals(that.graph()) &&
      deepEqual(this._scores, that._scores) &&
      deepEqual(this._edgeWeights, that._edgeWeights) &&
      this._syntheticLoopWeight === that._syntheticLoopWeight
    );
  }

  /**
   * Serialize this graph into a PagerankJSON object.
   *
   * Returns a plain JavaScript object.
   *
   * For space efficency, we store the node scores as an array of numbers in
   * node-address-sorted order, and we store the edge weights as two arrays of
   * numbers in edge-address-sorted-order.
   */
  toJSON(): PagerankGraphJSON {
    this._verifyGraphNotModified();

    const graphJSON = this.graph().toJSON();
    const nodes = sortedNodeAddressesFromJSON(graphJSON);
    const scores: number[] = nodes.map((x) =>
      NullUtil.get(this._scores.get(x))
    );

    const edgeAddresses = sortedEdgeAddressesFromJSON(graphJSON);
    const edgeWeights: EdgeWeight[] = edgeAddresses.map((x) =>
      NullUtil.get(this._edgeWeights.get(x))
    );
    const toWeights: number[] = edgeWeights.map((x) => x.toWeight);
    const froWeights: number[] = edgeWeights.map((x) => x.froWeight);

    const rawJSON = {
      graphJSON,
      scores,
      toWeights,
      froWeights,
      syntheticLoopWeight: this.syntheticLoopWeight(),
    };

    return toCompat(COMPAT_INFO, rawJSON);
  }

  static fromJSON(json: PagerankGraphJSON): PagerankGraph {
    const {
      toWeights,
      froWeights,
      scores,
      graphJSON,
      syntheticLoopWeight,
    } = fromCompat(COMPAT_INFO, json);
    const graph = Graph.fromJSON(graphJSON);

    const nodes = sortedNodeAddressesFromJSON(graphJSON);
    const scoreMap: Map<NodeAddressT, number> = new Map();
    for (let i = 0; i < nodes.length; i++) {
      scoreMap.set(nodes[i], scores[i]);
    }

    const edges = sortedEdgeAddressesFromJSON(graphJSON);
    const edgeWeights: Map<EdgeAddressT, EdgeWeight> = new Map();
    for (let i = 0; i < edges.length; i++) {
      const toWeight = toWeights[i];
      const froWeight = froWeights[i];
      edgeWeights.set(edges[i], {toWeight, froWeight});
    }

    function evaluator(e: Edge): EdgeWeight {
      return NullUtil.get(edgeWeights.get(e.address));
    }

    const prg = new PagerankGraph(graph, evaluator, syntheticLoopWeight);
    // TODO(#1020): It's a little hacky to force the scores in like this;
    // consider adding an optional constructor argument to allow manually
    // setting the scores at construction time, if we ever find a use case
    // that needs it.
    prg._scores = scoreMap;
    return prg;
  }

  _verifyGraphNotModified() {
    if (this._graph.modificationCount() !== this._graphModificationCount) {
      throw new Error(
        "Error: The PagerankGraph's underlying Graph has been modified."
      );
    }
  }
}
