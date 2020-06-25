// @flow

import {type Weights} from "../core/weights";
import {type CredResult} from "./credResult";
import {type TimelineCredParameters} from "./timeline/params";
import {type PluginDeclarations} from "./pluginDeclaration";

import {get as nullGet} from "../util/null";
import {type EdgeWeight} from "../core/weights";
import type {TimestampMs} from "../util/timestamp";
import {
  type NodeWeightEvaluator,
  nodeWeightEvaluator,
  type EdgeWeightEvaluator,
  edgeWeightEvaluator,
} from "../core/algorithm/weightEvaluator";
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
  +timestamp: TimestampMs | null,
  +credSummary: NodeCredSummary,
  +credOverTime: NodeCredOverTime | null,
|};

export type CredEdge = {|
  +address: EdgeAddressT,
  +src: CredNode,
  +dst: CredNode,
  +rawWeight: EdgeWeight,
  +credSummary: EdgeCredSummary,
  +credOverTime: EdgeCredOverTime | null,
  +timestamp: TimestampMs,
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

export type Flow = EdgeFlow | MintFlow | ReturnFlow | SyntheticLoopFlow;

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

  constructor(result: CredResult) {
    this._credResult = result;
    const {weights, graph} = result.weightedGraph;
    const nodes = Array.from(graph.nodes());
    const edges = Array.from(graph.edges({showDangling: false}));
    this._nodeAddressToIndex = new Map(nodes.map((n, i) => [n.address, i]));
    this._edgeAddressToIndex = new Map(edges.map((n, i) => [n.address, i]));
    this._nodeEvaluator = nodeWeightEvaluator(weights);
    this._edgeEvaluator = edgeWeightEvaluator(weights);
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

  credResult(): CredResult {
    return this._credResult;
  }

  _promoteNode(n: GraphNode): CredNode {
    const idx = nullGet(this._nodeAddressToIndex.get(n.address));
    const credSummary = this._credResult.credData.nodeSummaries[idx];
    const credOverTime = this._credResult.credData.nodeOverTime[idx];
    const minted = this._nodeEvaluator(n.address);
    return {
      timestamp: n.timestampMs,
      description: n.description,
      address: n.address,
      credSummary,
      credOverTime,
      minted,
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
    const userPrefixes = []
      .concat(...this.plugins().map((x) => x.userTypes))
      .map((x) => x.prefix);
    const nodes = this.nodes();
    return nodes.filter((n) =>
      userPrefixes.some((p) => NodeAddress.hasPrefix(n.address, p))
    );
  }

  _promoteEdge(e: GraphEdge): CredEdge {
    const idx = nullGet(this._edgeAddressToIndex.get(e.address));
    const srcNode = nullGet(this.graph().node(e.src));
    const dstNode = nullGet(this.graph().node(e.dst));
    const credSummary = this._credResult.credData.edgeSummaries[idx];
    const credOverTime = this._credResult.credData.edgeOverTime[idx];
    const rawWeight = this._edgeEvaluator(e.address);
    return {
      timestamp: e.timestampMs,
      address: e.address,
      src: this._promoteNode(srcNode),
      dst: this._promoteNode(dstNode),
      credSummary,
      credOverTime,
      rawWeight,
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
    const {seedFlow, syntheticLoopFlow, cred} = credNode.credSummary;
    if (syntheticLoopFlow > 0) {
      flows.push({type: "SYNTHETIC_LOOP", flow: syntheticLoopFlow});
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
}

function xor(a: boolean, b: boolean): boolean {
  return (a && !b) || (!a && b);
}
