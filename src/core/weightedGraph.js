// @flow

import deepEqual from "lodash.isequal";
import {
  Direction,
  EdgeAddress,
  Graph,
  NodeAddress,
  type Edge,
  type EdgeAddressT,
  type EdgesOptions,
  type GraphJSON,
  type ModificationCount,
  type Node,
  type NodeAddressT,
} from "./graph";
import {
  nodeWeightEvaluator,
  edgeWeightEvaluator,
  type NodeWeightEvaluator,
  type EdgeWeightEvaluator,
} from "./algorithm/weightEvaluator";
import {
  type EdgeWeight,
  type NodeWeight,
  type Weights as WeightsT,
  type WeightsJSON,
} from "./weights";
import * as Weights from "./weights";
import {toCompat, fromCompat, type Compatible} from "../util/compat";
import * as NullUtil from "../util/null";

/** The WeightedGraph a Graph alongside associated Weights
 *
 * Any combination of Weights and Graph can make a valid WeightedGraph. If the
 * Weights contains weights for node or edge addresses that are not present in
 * the graph, then those weights will be ignored. If the graph contains nodes
 * or edges which do not correspond to any weights, then default weights will
 * be inferred.
 */
export type WeightedGraph = {|+graph: Graph, +weights: WeightsT|};

const COMPAT_INFO = {type: "sourcecred/weightedGraph", version: "0.1.0"};

export type WeightedGraphJSON = Compatible<{|
  +graphJSON: GraphJSON,
  +weightsJSON: WeightsJSON,
|}>;

/**
 * Create a new, empty WeightedGraph.
 */
export function empty(): WeightedGraph {
  return {graph: new Graph(), weights: Weights.empty()};
}

export function toJSON(w: WeightedGraph): WeightedGraphJSON {
  const graphJSON = w.graph.toJSON();
  const weightsJSON = Weights.toJSON(w.weights);
  return toCompat(COMPAT_INFO, {graphJSON, weightsJSON});
}

export function fromJSON(j: WeightedGraphJSON): WeightedGraph {
  const {graphJSON, weightsJSON} = fromCompat(COMPAT_INFO, j);
  const graph = Graph.fromJSON(graphJSON);
  const weights = Weights.fromJSON(weightsJSON);
  return {graph, weights};
}

/**
 * Merge multiple WeightedGraphs together.
 *
 * This delegates to the semantics of Graph.merge and Weights.merge.
 */
export function merge(ws: $ReadOnlyArray<WeightedGraph>): WeightedGraph {
  const graph = Graph.merge(ws.map((w) => w.graph));
  const weights = Weights.merge(ws.map((w) => w.weights));
  return {graph, weights};
}

/**
 * Create a new WeightedGraph where default weights have been overriden.
 *
 * This takes a base WeightedGraph along with a set of "override" weights. The
 * new graph has the union of both the base and override weights; wherever
 * there is a conflict, the override weights will replace the base weights.
 * This is useful in situations where we want to let the user manually specify
 * some weights, and ensure that the user's decisions will trump any defaults.
 *
 * This method does not mutuate any of the original arguments. For performance
 * reasons, it is not a full copy; the input and output WeightedGraphs have the
 * exact same underlying Graph, which should not be modified.
 */
export function overrideWeights(
  wg: WeightedGraph,
  overrides: WeightsT
): WeightedGraph {
  const weights = Weights.merge([wg.weights, overrides], {
    nodeResolver: (a, b) => b,
    edgeResolver: (a, b) => b,
  });
  return {graph: wg.graph, weights};
}

export function fibrate(
  wg: WeightedGraph,
  prefixes: $ReadOnlyArray<NodeAddressT>,
  timeBoundariesMs: $ReadOnlyArray<number>
): WeightedGraph {
  const newGraph = wg.graph.fibrate(prefixes, timeBoundariesMs);
  const newWeights = Weights.empty();
  // TODO(@wchargin): Deduplicate these constants.
  const epochNodePrefix = NodeAddress.fromParts([
    "sourcecred",
    "core",
    "fibration",
    "EPOCH",
  ]);
  const epochEdgePrefix = EdgeAddress.fromParts([
    "sourcecred",
    "core",
    "fibration",
    "EPOCH_OWNED_BY",
  ]);
  newWeights.nodeWeights.set(epochNodePrefix, 1.0);
  newWeights.edgeWeights.set(epochEdgePrefix, {forwards: 1.0, backwards: 0.0});
  return overrideWeights({graph: newGraph, weights: wg.weights}, newWeights);
}

export const WeightedGraphC = class WeightedGraph {
  _graph: Graph;
  _weights: WeightsT;
  _originalModificationCount: ModificationCount;
  _originalWeights: WeightsT;
  _transitionProbabilities: Map<EdgeAddressT, EdgeWeight>;
  _nodeEvaluator: NodeWeightEvaluator;
  _edgeEvaluator: EdgeWeightEvaluator;

  constructor(graph: Graph, weights: WeightsT) {
    this._graph = graph;
    this._weights = weights;
    this._originalModificationCount = this._graph.modificationCount();
    this._originalWeights = Weights.copy(this._weights);

    this._nodeEvaluator = nodeWeightEvaluator(this._weights);
    this._edgeEvaluator = edgeWeightEvaluator(this._weights);
    this._transitionProbabilities = this._computeTransitionProbabilities();
  }

  _computeTransitionProbabilities(): Map<EdgeAddressT, EdgeWeight> {
    const result = new Map();

    const totalOutWeights: Map<NodeAddressT, number> = new Map();
    for (const node of this._graph.nodes()) {
      totalOutWeights.set(node.address, 0.0);
    }

    // Set up total weights
    for (const edge of this._graph.edges({showDangling: false})) {
      const edgeWeight = this._edgeEvaluator(edge.address);
      const {forwards, backwards} = this._edgeEvaluator(edge.address);
      totalOutWeights.set(
        edge.src,
        NullUtil.get(totalOutWeights.get(edge.src)) + forwards
      );
      totalOutWeights.set(
        edge.dst,
        NullUtil.get(totalOutWeights.get(edge.dst)) + backwards
      );
    }

    // Compute transition probabilities
    for (const edge of this._graph.edges({showDangling: false})) {
      const edgeWeight = this._edgeEvaluator(edge.address);
      const {forwards, backwards} = this._edgeEvaluator(edge.address);
      totalOutWeights.set(
        edge.src,
        NullUtil.get(totalOutWeights.get(edge.src)) + forwards
      );
      totalOutWeights.set(
        edge.dst,
        NullUtil.get(totalOutWeights.get(edge.dst)) + backwards
      );
    }

    return result;
  }

  _checkUnmodified() {
    const actualModificationCount = this._graph.modificationCount();
    const originalModificationCount = this._originalModificationCount;
    if (actualModificationCount !== originalModificationCount) {
      throw new Error(
        `Underlying graph modified ` +
          `(${actualModificationCount} !== ${originalModificationCount}`
      );
    }

    if (!deepEqual(this._weights, this._originalWeights)) {
      throw new Error("Underlying weights modified");
    }
  }

  node(address: NodeAddressT): ?WeightedNode {
    this._checkUnmodified();
    const node = this._graph.node(address);
    if (node == null) return node;
    const weight = NullUtil.orElse(this._weights.nodeWeights.get(address), 1.0);
    return {node, weight};
  }

  _edgeWeight(address: EdgeAddressT) {}

  edge(address: EdgeAddressT): ?WeightedEdge {
    this._checkUnmodified();
    const edge = this._graph.edge(address);
    if (edge == null) return edge;
    const weight = NullUtil.orElse(this._weights.edgeWeights.get(address), {
      forwards: 1.0,
      backwards: 1.0,
    });
    return {edge, weight};
  }

  *nodes(options?: {|+prefix: NodeAddressT|}): Iterator<WeightedNode> {
    for (const node of this._graph.nodes(options)) {
      yield NullUtil.get(this.node(node.address));
    }
  }

  *edges(options: EdgesOptions): Iterator<WeightedEdge> {
    for (const edge of this._graph.edges(options)) {
      yield NullUtil.get(this.edge(edge.address));
    }
  }

  fibrate(
    prefixes: $ReadOnlyArray<NodeAddressT>,
    timeBoundariesMs: $ReadOnlyArray<number>
  ): WeightedGraphC {
    const raw = fibrate(
      {graph: this._graph, weights: this._weights},
      prefixes,
      timeBoundariesMs
    );
    return new WeightedGraphC(raw.graph, raw.weights);
  }

  toJSON() {
    return toJSON({graph: this._graph, weights: this._weights});
  }

  fromJSON(j: WeightedGraphJSON) {
    const raw = fromJSON(j);
    return new WeightedGraphC(raw.graph, raw.weights);
  }
};

export type WeightedNode = {|
  +node: Node,
  +weight: NodeWeight,
|};

export type WeightedEdge = {|
  +edge: Edge,
  +weight: EdgeWeight,
|};
