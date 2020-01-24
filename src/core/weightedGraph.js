// @flow

import {Graph, type GraphJSON, type NodeContraction} from "./graph";
import {type Weights as WeightsT, type WeightsJSON} from "./weights";
import * as Weights from "./weights";
import {toCompat, fromCompat, type Compatible} from "../util/compat";

export type WeightedGraph = {|
  +graph: Graph,
  +weights: WeightsT,
|};

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
 * Create a new WeightedGraph, in which some nodes were contracted together.
 *
 * This is a wrapper over `Graph.contractNodes`. No effort is made to contract
 * the weights; thus, it is entirely possible that nodes will "lose" their
 * associated weight during a contraction.
 *
 * These semantics are currently acceptable becuase `contractNodes` is used by
 * the identity plugin to collapse user identities together, and we currently
 * always give users a weight of 0 (as they do not mint cred). If we want to
 * start giving users specific weights, or if we begin using contractNodes for
 * other types of nodes in the graph, we should revisit this assumption.
 *
 * The original WeightedGraph is not mutated, and an independent WeightedGraph
 * is returned.
 */
export function contractNodes(
  wg: WeightedGraph,
  contractions: $ReadOnlyArray<NodeContraction>
): WeightedGraph {
  const graph = wg.graph.contractNodes(contractions);
  return {graph, weights: Weights.copy(wg.weights)};
}
