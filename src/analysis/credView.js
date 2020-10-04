// @flow

import sortedIndex from "lodash.sortedindex";
import {type Weights, type EdgeWeight} from "../core/weights";
import {type CredResult, compute} from "./credResult";
import {type TimelineCredParameters} from "./timeline/params";
import {type PluginDeclarations} from "./pluginDeclaration";
import {type NodeType, type EdgeType} from "./types";
import {IDENTITY_PREFIX} from "../core/identity";
import {type IntervalSequence} from "../core/interval";

import {get as nullGet} from "../util/null";
import type {TimestampMs} from "../util/timestamp";
import {
  type NodeWeightEvaluator,
  nodeWeightEvaluator,
  type EdgeWeightEvaluator,
  edgeWeightEvaluator,
} from "../core/algorithm/weightEvaluator";
import {NodeTrie, EdgeTrie} from "../core/trie";
import {
  Graph,
  type NodeAddressT,
  type EdgeAddressT,
  type Node as GraphNode,
  type Edge as GraphEdge,
  type DirectionT,
  Direction,
  NodeAddress,
  EdgeAddress,
} from "../core/graph";
import {overrideWeights} from "../core/weightedGraph";
import type {
  NodeCredSummary,
  NodeCredOverTime,
  EdgeCredSummary,
  EdgeCredOverTime,
} from "./credData";

export type CredNode = {|
  +address: NodeAddressT,
  +description: string,
  +minted: number,
  +credSummary: NodeCredSummary,
  +credOverTime: NodeCredOverTime | null,
  +type: NodeType | null,
  +timestamp: TimestampMs | null,
  // Index of the interval in which this node was created, assuming
  // non-null timestamp.
  +intervalIndex: number | null,
|};

export type CredEdge = {|
  +address: EdgeAddressT,
  +src: CredNode,
  +dst: CredNode,
  +rawWeight: EdgeWeight,
  +credSummary: EdgeCredSummary,
  +credOverTime: EdgeCredOverTime | null,
  +type: EdgeType | null,
  +timestamp: TimestampMs,
  // Index of the interval in which this edge was created
  +intervalIndex: number,
|};

export type EdgeFlow = {|
  +type: "EDGE",
  +edge: CredEdge,
  +neighbor: CredNode,
  +flow: number,
|};

export type ReturnFlow = {|
  +type: "RADIATE",
  +flow: number,
|};

export type MintFlow = {|
  +type: "MINT",
  +flow: number,
|};

export type SyntheticLoopFlow = {|
  +type: "SYNTHETIC_LOOP",
  +flow: number,
|};

export type DependencyMintFlow = {|
  +type: "DEPENDENCY_MINT",
  +flow: number,
|};

export type Flow =
  | EdgeFlow
  | MintFlow
  | ReturnFlow
  | SyntheticLoopFlow
  | DependencyMintFlow;

export type EdgesOptions = {|
  // An edge address prefix. Only show edges whose addresses match this prefix.
  +addressPrefix?: EdgeAddressT,
  // A node address prefix. Only show edges whose src matches
  // this prefix.
  +srcPrefix?: NodeAddressT,
  // A node address prefix. Only show edges whose dst matches
  // this prefix.
  +dstPrefix?: NodeAddressT,
|};

/**
 * The CredView is an interface for Graph-aware queries over a CredResult.
 *
 * For example, if you want to find out all of the flows of cred into or out of a node,
 * then you need to overlay Cred data on the structure of the Graph. This class makes
 * such queries convenient.
 */
export class CredView {
  +_credResult: CredResult;
  +_nodeAddressToIndex: Map<NodeAddressT, number>;
  +_edgeAddressToIndex: Map<EdgeAddressT, number>;
  +_nodeEvaluator: NodeWeightEvaluator;
  +_edgeEvaluator: EdgeWeightEvaluator;
  +_nodeTypeTrie: NodeTrie<NodeType>;
  +_edgeTypeTrie: EdgeTrie<EdgeType>;

  constructor(result: CredResult) {
    this._credResult = result;
    const {weights, graph} = result.weightedGraph;
    const nodes = Array.from(graph.nodes());
    const edges = Array.from(graph.edges({showDangling: false}));
    this._nodeAddressToIndex = new Map(nodes.map((n, i) => [n.address, i]));
    this._edgeAddressToIndex = new Map(edges.map((n, i) => [n.address, i]));
    this._nodeEvaluator = nodeWeightEvaluator(weights);
    this._edgeEvaluator = edgeWeightEvaluator(weights);
    const nodeTypes = [].concat(...result.plugins.map((p) => p.nodeTypes));
    this._nodeTypeTrie = new NodeTrie();
    for (const t of nodeTypes) {
      this._nodeTypeTrie.add(t.prefix, t);
    }
    const edgeTypes = [].concat(...result.plugins.map((p) => p.edgeTypes));
    this._edgeTypeTrie = new EdgeTrie();
    for (const t of edgeTypes) {
      this._edgeTypeTrie.add(t.prefix, t);
    }
  }

  graph(): Graph {
    return this._credResult.weightedGraph.graph;
  }

  weights(): Weights {
    return this._credResult.weightedGraph.weights;
  }

  params(): TimelineCredParameters {
    return this._credResult.params;
  }

  plugins(): PluginDeclarations {
    return this._credResult.plugins;
  }

  intervals(): IntervalSequence {
    return this._credResult.credData.intervals;
  }

  credResult(): CredResult {
    return this._credResult;
  }

  _promoteNode(n: GraphNode): CredNode {
    const timestamp = n.timestampMs;
    const idx = nullGet(this._nodeAddressToIndex.get(n.address));
    const credSummary = this._credResult.credData.nodeSummaries[idx];
    const credOverTime = this._credResult.credData.nodeOverTime[idx];
    const minted = this._nodeEvaluator(n.address);
    const type = this._nodeTypeTrie.getLast(n.address);
    const intervalIndex =
      timestamp == null ? null : _getIntervalIndex(this.intervals(), timestamp);
    return {
      timestamp: n.timestampMs,
      description: n.description,
      address: n.address,
      credSummary,
      credOverTime,
      minted,
      type: type ? type : null,
      intervalIndex,
    };
  }
  node(a: NodeAddressT): ?CredNode {
    const graphNode = this.graph().node(a);
    if (graphNode == null) {
      return undefined;
    }
    return this._promoteNode(graphNode);
  }
  nodes(options?: {|+prefix: NodeAddressT|}): $ReadOnlyArray<CredNode> {
    const graphNodes = Array.from(this.graph().nodes(options));
    return graphNodes.map((x) => this._promoteNode(x));
  }
  userNodes(): $ReadOnlyArray<CredNode> {
    return this.nodes({prefix: IDENTITY_PREFIX});
  }

  _promoteEdge(e: GraphEdge): CredEdge {
    const idx = nullGet(this._edgeAddressToIndex.get(e.address));
    const srcNode = nullGet(this.graph().node(e.src));
    const dstNode = nullGet(this.graph().node(e.dst));
    const credSummary = this._credResult.credData.edgeSummaries[idx];
    const credOverTime = this._credResult.credData.edgeOverTime[idx];
    const rawWeight = this._edgeEvaluator(e.address);
    const type = this._edgeTypeTrie.getLast(e.address);
    return {
      timestamp: e.timestampMs,
      address: e.address,
      src: this._promoteNode(srcNode),
      dst: this._promoteNode(dstNode),
      credSummary,
      credOverTime,
      rawWeight,
      type: type ? type : null,
      intervalIndex: _getIntervalIndex(this.intervals(), e.timestampMs),
    };
  }
  edge(a: EdgeAddressT): ?CredEdge {
    const graphEdge = this.graph().edge(a);
    if (graphEdge == null || this.graph().isDanglingEdge(a)) {
      return undefined;
    }
    return this._promoteEdge(graphEdge);
  }
  edges(options?: EdgesOptions): $ReadOnlyArray<CredEdge> {
    const graphEdges = Array.from(
      this.graph().edges({...options, showDangling: false})
    );
    return graphEdges.map((x) => this._promoteEdge(x));
  }

  inflows(addr: NodeAddressT): ?$ReadOnlyArray<Flow> {
    return this._flows(addr, Direction.IN);
  }

  outflows(addr: NodeAddressT): ?$ReadOnlyArray<Flow> {
    return this._flows(addr, Direction.OUT);
  }

  _flows(addr: NodeAddressT, direction: DirectionT): ?$ReadOnlyArray<Flow> {
    const credNode = this.node(addr);
    if (credNode == null) {
      return undefined;
    }
    const {alpha} = this.params();
    const flows: Flow[] = [];
    const {
      seedFlow,
      syntheticLoopFlow,
      cred,
      dependencyMintedCred,
    } = credNode.credSummary;
    if (syntheticLoopFlow > 0) {
      flows.push({type: "SYNTHETIC_LOOP", flow: syntheticLoopFlow});
    }
    if (dependencyMintedCred > 0) {
      flows.push({type: "DEPENDENCY_MINT", flow: dependencyMintedCred});
    }
    if (direction === Direction.IN) {
      if (seedFlow > 0) {
        flows.push({type: "MINT", flow: seedFlow});
      }
    } else {
      flows.push({type: "RADIATE", flow: cred * alpha});
    }

    for (const {edge, node} of this.graph().neighbors(addr, {
      direction: Direction.ANY,
      nodePrefix: NodeAddress.empty,
      edgePrefix: EdgeAddress.empty,
    })) {
      const credEdge = nullGet(this.edge(edge.address));
      const credNeighbor = nullGet(this.node(node.address));
      const {forwardFlow, backwardFlow} = credEdge.credSummary;
      const flowDirection = xor(addr === edge.src, direction === Direction.IN);
      const edgeFlow: EdgeFlow = {
        type: "EDGE",
        edge: credEdge,
        neighbor: credNeighbor,
        flow: flowDirection ? forwardFlow : backwardFlow,
      };
      flows.push(edgeFlow);
    }
    return flows;
  }

  /**
   * Compute a new CredView, with new params and weights but using the
   * graph from this CredView.
   */
  async recompute(
    weights: Weights,
    params: TimelineCredParameters
  ): Promise<CredView> {
    const wg = overrideWeights(this._credResult.weightedGraph, weights);
    const credResult = await compute(
      wg,
      params,
      this.plugins(),
      this._credResult.dependencyPolicies
    );
    return new CredView(credResult);
  }
}

function xor(a: boolean, b: boolean): boolean {
  return (a && !b) || (!a && b);
}

// Exported separately for testing purposes.
export function _getIntervalIndex(
  intervals: IntervalSequence,
  ts: TimestampMs
): number {
  const ends = intervals.map((x) => x.endTimeMs);
  if (ts > ends[ends.length - 1]) {
    throw new Error(`timestamp out of interval range`);
  }
  return sortedIndex(ends, ts);
}
