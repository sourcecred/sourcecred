// @flow

import {Graph, type GraphJSON} from "./graph";
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
