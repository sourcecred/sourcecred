// @flow

import * as NullUtil from "../util/null";
import {
  type NodeAddressT,
  Graph,
  type Edge as UnderlyingGraphEdge,
  type Node as UnderlyingGraphNode,
  type EdgesOptions,
  type EdgeAddressT,
} from "./graph";
import * as WeightedGraph from "./weightedGraph";
import {type NodeWeight, type EdgeWeight} from "./weights";
import {
  nodeWeightEvaluator,
  edgeWeightEvaluator,
} from "./algorithm/weightEvaluator";
import {type WeightedGraph as WeightedGraphT} from "./weightedGraph";
import {
  MarkovProcessGraph,
  type MarkovEdge,
  type MarkovNode,
} from "./markovProcessGraph";

export type Node = {|
  +address: NodeAddressT,
  +description: string,
  +cred: number,
|};

export type Edge = {|
  +address: EdgeAddressT,
  +reversed: boolean,
  +src: NodeAddressT,
  +dst: NodeAddressT,
  +transitionProbability: TransitionProbability,
  +credFlow: number,
|};

export class CredGraph {
  _mpg: MarkovProcessGraph;
  _scores: Map<NodeAddressT, number>;

  constructor(
    markovProcessGraph: MarkovProcessGraph,
    scores: Map<NodeAddressT, number>
  ) {
    this._mpg = markovProcessGraph;
    this._scores = scores;
  }

  _cred(addr: NodeAddressT): number {
    return NullUtil.get(this._scores.get(addr));
  }

  _credFlow(edge: MarkovEdge): number {
    const srcCred = this._cred(edge.src);
    return srcCred * edge.transitionProbability;
  }

  *nodes(options?: {|+prefix: NodeAddressT|}): Iterator<Node> {
    for (const node of this._mpg.nodes(options)) {
      yield {...node, cred: this._cred(node.address)};
    }
  }

  *edges(options: EdgesOptions): Iterator<Edge> {
    for (const edge of this._mpg.edges(options)) {
      yield {...edge, credFlow: this._credFlow(edge)};
    }
  }

  *neighbors(addr: NodeAddressT): Iterator<Edge> {
    for (const edge of this._mpg.neighbors(addr)) {
      yield {...edge, credFlow: this._credFlow(edge)};
    }
  }
}
