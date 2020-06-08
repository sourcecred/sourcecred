// @flow

import * as NullUtil from "../util/null";
import * as MapUtil from "../util/map";
import {type NodeAddressT, type EdgeAddressT} from "./graph";
import {type NodeWeight} from "./weights";
import {
  MarkovProcessGraph,
  type MarkovProcessGraphJSON,
  type MarkovEdge,
  type TransitionProbability,
} from "./markovProcessGraph";

export type Node = {|
  +address: NodeAddressT,
  +description: string,
  +cred: number,
  +weight: NodeWeight,
|};

export type Edge = {|
  +address: EdgeAddressT,
  +reversed: boolean,
  +src: NodeAddressT,
  +dst: NodeAddressT,
  +transitionProbability: TransitionProbability,
  +credFlow: number,
|};

export type CredGraphJSON = {|
  +mpg: MarkovProcessGraphJSON,
  +scores: {|+[NodeAddressT]: number|},
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

  node(addr: NodeAddressT): ?Node {
    const node = this._mpg._nodes.get(addr);
    if (node == null) return undefined;
    return {...node, cred: this._cred(addr)};
  }

  *nodes(): Iterator<Node> {
    for (const node of this._mpg.nodes()) {
      yield {...node, cred: this._cred(node.address)};
    }
  }

  *edges(): Iterator<Edge> {
    for (const edge of this._mpg.edges()) {
      yield {...edge, credFlow: this._credFlow(edge)};
    }
  }

  *scoringNodes(): Iterator<Node> {
    for (const addr of this._mpg.scoringAddresses()) {
      yield NullUtil.get(this.node(addr));
    }
  }

  *inNeighbors(addr: NodeAddressT): Iterator<Edge> {
    for (const edge of this._mpg.inNeighbors(addr)) {
      yield {...edge, credFlow: this._credFlow(edge)};
    }
  }

  toJSON(): CredGraphJSON {
    return {
      mpg: this._mpg.toJSON(),
      scores: MapUtil.toObject(this._scores),
    };
  }

  static fromJSON(j: CredGraphJSON): CredGraph {
    return new CredGraph(
      MarkovProcessGraph.fromJSON(j.mpg),
      MapUtil.fromObject(j.scores)
    );
  }
}
