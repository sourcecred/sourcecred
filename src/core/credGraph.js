// @flow

import * as NullUtil from "../util/null";
import {type Uuid} from "../util/uuid";
import {type NodeAddressT, type EdgeAddressT} from "./graph";
import {
  MarkovProcessGraph,
  type MarkovProcessGraphJSON,
  type MarkovEdge,
  type TransitionProbability,
  markovEdgeAddress,
  payoutAddressForEpoch,
  COMPAT_INFO as MPG_COMPAT_INFO,
} from "./markovProcessGraph";
import {toCompat, fromCompat, type Compatible} from "../util/compat";

export type Node = {|
  +address: NodeAddressT,
  +description: string,
  +cred: number,
  +mint: number,
|};

export type Edge = {|
  +address: EdgeAddressT,
  +reversed: boolean,
  +src: NodeAddressT,
  +dst: NodeAddressT,
  +transitionProbability: TransitionProbability,
  +credFlow: number,
|};

export type Participant = {|
  +address: NodeAddressT,
  +description: string,
  +cred: number,
  +credPerEpoch: $ReadOnlyArray<number>,
  +id: Uuid,
|};

export type CredGraphJSON = Compatible<{|
  +mpg: MarkovProcessGraphJSON,
  // scores for each node in the same node order used by the markov process graph
  +scores: $ReadOnlyArray<number>,
|}>;

export const COMPAT_INFO = {type: "sourcecred/credGraph", version: "0.1.0"};

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
    const srcCred /* heh */ = this._cred(edge.src);
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

  *participants(): Iterator<Participant> {
    for (const {address, description, id} of this._mpg.participants()) {
      const epochs = this._mpg.epochBoundaries().map((epochStart) => ({
        type: "USER_EPOCH",
        owner: address,
        epochStart,
      }));
      let totalCred = 0;
      const credPerEpoch = epochs.map((e) => {
        const payoutEdgeAddress = payoutAddressForEpoch(e);
        const payoutMarkovEdgeAddress = markovEdgeAddress(
          payoutEdgeAddress,
          "F"
        );
        const payoutMarkovEdge = NullUtil.get(
          this._mpg._edges.get(payoutMarkovEdgeAddress)
        );
        const cred = this._credFlow(payoutMarkovEdge);
        totalCred += cred;
        return cred;
      });
      yield {address, description, credPerEpoch, cred: totalCred, id};
    }
  }

  *inNeighbors(addr: NodeAddressT): Iterator<Edge> {
    for (const edge of this._mpg.inNeighbors(addr)) {
      yield {...edge, credFlow: this._credFlow(edge)};
    }
  }

  toJSON(): CredGraphJSON {
    const mpgJson = this._mpg.toJSON();
    const {sortedNodes} = fromCompat(MPG_COMPAT_INFO, mpgJson);
    const scores = sortedNodes.map((n) =>
      NullUtil.get(this._scores.get(n.address))
    );
    return toCompat(COMPAT_INFO, {
      mpg: mpgJson,
      scores,
    });
  }

  static fromJSON(j: CredGraphJSON): CredGraph {
    const {mpgJson, scores} = fromCompat(COMPAT_INFO, j);
    const {sortedNodes} = fromCompat(MPG_COMPAT_INFO, mpgJson);
    const scoresMap = new Map();
    sortedNodes.forEach((n, i) => {
      scoresMap.set(n.address, scores[i]);
    });
    return new CredGraph(MarkovProcessGraph.fromJSON(mpgJson), scoresMap);
  }
}
