// @flow

import * as NullUtil from "../../util/null";
import {type Uuid} from "../../util/uuid";
import {type NodeAddressT, type EdgeAddressT} from "../graph";
import {
  MarkovProcessGraph,
  type MarkovProcessGraphJSON,
  payoutAddressForEpoch,
} from "./markovProcessGraph";
import {
  type MarkovEdge,
  type TransitionProbability,
  markovEdgeAddress,
} from "./markovEdge";
import {toCompat, fromCompat, type Compatible} from "../../util/compat";

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
  // Scores must be inserted in the same order as the nodes in the underlying
  // MarkovProcessGraph
  // TODO(@decentralion, @wchargin): Can probably replace this with an array if
  // we add a `nodeIndex` method to the underlying MarkovProcessGraph
  _scores: $ReadOnlyMap<NodeAddressT, number>;

  constructor(
    markovProcessGraph: MarkovProcessGraph,
    scores: Map<NodeAddressT, number>
  ) {
    this._mpg = markovProcessGraph;
    this._scores = scores;
    // Invariant check: the scores must have the same iteration order as the
    // nodes in the underlying markovProcessGraph
    // TODO(@decentralion,@wchargin): Can optimize this out by just testing for
    // it without any runtime invariant checks
    const nodeOrder = this._mpg.nodeOrder();
    const scoreNodeOrder = scores.keys();
    while (true) {
      const a1 = nodeOrder.next();
      const a2 = scoreNodeOrder.next();
      if (a1.done !== a2.done) {
        throw new Error(`nodeOrder And scoreNodeOrder have different lengths`);
      }
      if (a1.done) {
        break;
      }
      if (a1.value !== a2.value) {
        throw new Error(
          `MarkovProcessGraph and scores have different node orders`
        );
      }
    }
  }

  _cred(addr: NodeAddressT): number {
    return NullUtil.get(this._scores.get(addr));
  }

  _credFlow(edge: MarkovEdge): number {
    const srcCred /* heh */ = this._cred(edge.src);
    return srcCred * edge.transitionProbability;
  }

  node(addr: NodeAddressT): ?Node {
    const node = this._mpg.node(addr);
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
          this._mpg.edge(payoutMarkovEdgeAddress)
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
    const scores = Array.from(this._scores.values());
    return toCompat(COMPAT_INFO, {
      mpg: mpgJson,
      scores,
    });
  }

  static fromJSON(j: CredGraphJSON): CredGraph {
    const {mpgJson, scores} = fromCompat(COMPAT_INFO, j);
    const mpg = MarkovProcessGraph.fromJSON(mpgJson);
    const nodeOrder = mpg.nodeOrder();
    const scoresMap = new Map();
    let i = 0;
    for (const address of nodeOrder) {
      scoresMap.set(address, scores[i++]);
    }
    return new CredGraph(mpg, scoresMap);
  }
}
