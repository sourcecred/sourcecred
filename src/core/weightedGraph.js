// @flow

import {
  type Edge,
  type EdgesOptions,
  type NeighborsOptions,
  Graph,
  type GraphJSON,
  type EdgeAddressT,
  type NodeAddressT,
  NodeAddress,
  edgeToString,
  sortedEdgeAddressesFromJSON,
} from "./graph";

import deepEqual from "lodash.isequal";
import {toCompat, fromCompat, type Compatible} from "../util/compat";
import type {EdgeWeight} from "./attribution/graphToMarkovChain";
import * as NullUtil from "../util/null";

export type {EdgeWeight} from "./attribution/graphToMarkovChain";
export type WeightedEdge = {|+edge: Edge, +weight: EdgeWeight|};
export type WeightedNeighbor = {|
  +edge: Edge,
  +node: NodeAddressT,
  +weight: EdgeWeight,
|};
export type EdgeEvaluator = (Edge) => EdgeWeight;

const COMPAT_INFO = {type: "sourcecred/weightedGraph", version: "0.1.0"};
export opaque type WeightedGraphJSON = Compatible<{|
  +graph: GraphJSON,
  // sorted by edgeAddress
  +sortedEdgeWeights: EdgeWeight[],
  +syntheticLoopWeight: number,
|}>;

export class WeightedGraph {
  _graph: Graph;
  _edgeWeights: Map<EdgeAddressT, EdgeWeight>;
  _syntheticLoopWeight: number;
  _totalOutWeight: Map<NodeAddressT, number>;

  constructor(
    graph: Graph,
    edgeWeights: Map<EdgeAddressT, EdgeWeight>,
    syntheticLoopWeight: number
  ): void {
    this._graph = graph;
    this._edgeWeights = edgeWeights;
    this._syntheticLoopWeight = syntheticLoopWeight;
    this._totalOutWeight = new Map();
    for (const n of graph.nodes()) {
      this._totalOutWeight.set(n, syntheticLoopWeight);
    }
    let nEdgesEncountered = 0;
    for (const e of graph.edges()) {
      const edgeWeight = this._edgeWeights.get(e.address);
      if (edgeWeight == null) {
        throw new Error(`Missing weight for edge ${edgeToString(e)}`);
      }
      const {toWeight, froWeight} = edgeWeight;
      const srcOutWeight =
        NullUtil.get(this._totalOutWeight.get(e.src)) + toWeight;
      this._totalOutWeight.set(e.src, srcOutWeight);
      const dstOutWeight =
        NullUtil.get(this._totalOutWeight.get(e.dst)) + froWeight;
      this._totalOutWeight.set(e.dst, dstOutWeight);
      nEdgesEncountered += 1;
    }
    if (nEdgesEncountered !== this._edgeWeights.size) {
      // It must be that edgeWeights.size is bigger, because we already
      // would have errored if any edges were missing a weight
      // (in NullUtil.get)
      throw new Error(
        "There are edge weights that don't correspond to any edge"
      );
    }
    if (syntheticLoopWeight <= 0) {
      throw new Error(
        `syntheticLoopWeight must be positive, but is ${syntheticLoopWeight}`
      );
    }
  }

  hasNode(a: NodeAddressT): boolean {
    return this._graph.hasNode(a);
  }
  nodes(options?: {|+prefix: NodeAddressT|}): Iterator<NodeAddressT> {
    return this._graph.nodes(options);
  }
  hasEdge(address: EdgeAddressT): boolean {
    return this._graph.hasEdge(address);
  }

  edge(address: EdgeAddressT): ?WeightedEdge {
    const edge = this._graph.edge(address);
    if (edge == null) {
      return null;
    }
    const weight = NullUtil.get(this._edgeWeights.get(edge.address));
    return {edge, weight};
  }

  *edges(options?: EdgesOptions): Iterator<WeightedEdge> {
    for (const edge of this._graph.edges(options)) {
      const weight = NullUtil.get(this._edgeWeights.get(edge.address));
      yield {edge, weight};
    }
  }

  *neighbors(
    node: NodeAddressT,
    options: NeighborsOptions
  ): Iterator<WeightedNeighbor> {
    for (const {node, edge} of this._graph.neighbors(node, options)) {
      const weight = NullUtil.get(this._edgeWeights.get(edge.address));
      yield {node, edge, weight};
    }
  }

  totalOutWeight(n: NodeAddressT): number {
    const w = this._totalOutWeight.get(n);
    if (w == null) {
      throw new Error(
        `Tried to retrieve weight for nonexistent node ${NodeAddress.toString(
          n
        )}`
      );
    }
    return w;
  }

  syntheticLoopWeight(): number {
    return this._syntheticLoopWeight;
  }

  equals(that: WeightedGraph): boolean {
    return (
      this._graph.equals(that._graph) &&
      this._syntheticLoopWeight === that._syntheticLoopWeight &&
      deepEqual(this._edgeWeights, that._edgeWeights)
    );
  }

  toJSON(): WeightedGraphJSON {
    const graphJSON = this._graph.toJSON();
    const sortedEdgeAddresses = sortedEdgeAddressesFromJSON(graphJSON);
    const sortedEdgeWeights = sortedEdgeAddresses.map((x) =>
      NullUtil.get(this._edgeWeights.get(x))
    );
    const rawJSON = {
      graph: graphJSON,
      sortedEdgeWeights,
      syntheticLoopWeight: this._syntheticLoopWeight,
    };
    return toCompat(COMPAT_INFO, rawJSON);
  }

  static fromJSON(json: WeightedGraphJSON): WeightedGraph {
    const {
      graph: graphJSON,
      sortedEdgeWeights,
      syntheticLoopWeight,
    } = fromCompat(COMPAT_INFO, json);
    const graph = Graph.fromJSON(graphJSON);
    const sortedEdgeAddresses = sortedEdgeAddressesFromJSON(graphJSON);
    const edgeWeights = new Map();
    for (let i = 0; i < sortedEdgeAddresses.length; i++) {
      edgeWeights.set(sortedEdgeAddresses[i], sortedEdgeWeights[i]);
    }
    return new WeightedGraph(graph, edgeWeights, syntheticLoopWeight);
  }

  // Alternative API to using the constructor.
  // (Really just a light sugar.)
  static fromEvaluator(
    graph: Graph,
    evaluator: EdgeEvaluator,
    syntheticLoopWeight: number
  ): WeightedGraph {
    const edgeWeights = new Map();
    for (const e of graph.edges()) {
      edgeWeights.set(e.address, evaluator(e));
    }
    return new WeightedGraph(graph, edgeWeights, syntheticLoopWeight);
  }
}

/**
 * Extract a GraphJSON from a WeightedGraphJSON. This is made available
 * so that clients of WeightedGraph can retrieve the sorted Node/Edge addresses
 * from the WeightedGraph's contained GraphJSON.
 */
export function extractGraphJSON(j: WeightedGraphJSON): GraphJSON {
  const {graph: graphJSON} = fromCompat(COMPAT_INFO, j);
  return graphJSON;
}
