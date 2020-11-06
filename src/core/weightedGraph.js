// @flow

import deepEqual from "lodash.isequal";
import {Graph, type GraphJSON, type Node, type Edge} from "./graph";
import {type Weights as WeightsT, type WeightsJSON} from "./weights";
import * as Weights from "./weights";
import {toCompat, fromCompat, type Compatible} from "../util/compat";

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

export type NodeWithWeight = {|
  +node: Node,
  +weight: ?Weights.NodeWeight,
|};

export type EdgeWithWeight = {|
  +edge: Edge,
  +weight: ?Weights.EdgeWeight,
|};

export type WeightedGraphComparison = {|
  +weightedGraphsAreEqual: boolean,
  +uniqueNodesInFirst: $ReadOnlyArray<NodeWithWeight>,
  +uniqueNodesInSecond: $ReadOnlyArray<NodeWithWeight>,
  +nodeTuplesWithDifferences: $ReadOnlyArray<[NodeWithWeight, NodeWithWeight]>,
  +uniqueEdgesInFirst: $ReadOnlyArray<EdgeWithWeight>,
  +uniqueEdgesInSecond: $ReadOnlyArray<EdgeWithWeight>,
  +edgeTuplesWithDifferences: $ReadOnlyArray<[EdgeWithWeight, EdgeWithWeight]>,
|};

export function compareWeightedGraphs(
  firstGraph: WeightedGraph,
  secondGraph: WeightedGraph
): WeightedGraphComparison {
  const uniqueNodesInFirst = [];
  const uniqueNodesInSecond = [];
  const nodeTuplesWithDifferences = [];
  const uniqueEdgesInFirst = [];
  const uniqueEdgesInSecond = [];
  const edgeTuplesWithDifferences = [];
  const weightedGraphsAreEqual =
    firstGraph.graph.equals(secondGraph.graph) &&
    deepEqual(firstGraph.weights, secondGraph.weights);

  if (!weightedGraphsAreEqual) {
    for (const firstNode of firstGraph.graph.nodes()) {
      const firstWeight = firstGraph.weights.nodeWeights.get(firstNode.address);
      const secondNode = secondGraph.graph.node(firstNode.address);
      if (secondNode) {
        const secondWeight = secondGraph.weights.nodeWeights.get(
          secondNode.address
        );
        if (
          !deepEqual(firstNode, secondNode) ||
          !deepEqual(firstWeight, secondWeight)
        )
          nodeTuplesWithDifferences.push([
            {node: firstNode, weight: firstWeight},
            {node: secondNode, weight: secondWeight},
          ]);
      } else {
        uniqueNodesInFirst.push({node: firstNode, weight: firstWeight});
      }
    }
    for (const secondNode of secondGraph.graph.nodes()) {
      const secondWeight = secondGraph.weights.nodeWeights.get(
        secondNode.address
      );
      const firstNode = firstGraph.graph.node(secondNode.address);
      if (!firstNode) {
        uniqueNodesInSecond.push({node: secondNode, weight: secondWeight});
      }
    }

    for (const firstEdge of firstGraph.graph.edges({showDangling: true})) {
      const firstWeight = firstGraph.weights.edgeWeights.get(firstEdge.address);
      const secondEdge = secondGraph.graph.edge(firstEdge.address);
      if (secondEdge) {
        const secondWeight = secondGraph.weights.edgeWeights.get(
          secondEdge.address
        );
        if (
          !deepEqual(firstEdge, secondEdge) ||
          !deepEqual(firstWeight, secondWeight)
        )
          edgeTuplesWithDifferences.push([
            {edge: firstEdge, weight: firstWeight},
            {edge: secondEdge, weight: secondWeight},
          ]);
      } else {
        uniqueEdgesInFirst.push({edge: firstEdge, weight: firstWeight});
      }
    }
    for (const secondEdge of secondGraph.graph.edges({showDangling: true})) {
      const secondWeight = secondGraph.weights.edgeWeights.get(
        secondEdge.address
      );
      const firstEdge = firstGraph.graph.edge(secondEdge.address);
      if (!firstEdge) {
        uniqueEdgesInSecond.push({edge: secondEdge, weight: secondWeight});
      }
    }
  }

  return {
    weightedGraphsAreEqual,
    uniqueNodesInFirst,
    uniqueNodesInSecond,
    nodeTuplesWithDifferences,
    uniqueEdgesInFirst,
    uniqueEdgesInSecond,
    edgeTuplesWithDifferences,
  };
}
