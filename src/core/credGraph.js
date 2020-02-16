// @flow

import * as NullUtil from "../util/null";
import {
  type NodeAddressT,
  Graph,
  type Edge,
  type Node,
  type EdgesOptions,
} from "./graph";
import * as WeightedGraph from "./weightedGraph";
import {type NodeWeight, type EdgeWeight} from "./weights";
import {
  nodeWeightEvaluator,
  edgeWeightEvaluator,
} from "./algorithm/weightEvaluator";
import {type WeightedGraph as WeightedGraphT} from "./weightedGraph";
import {
  type PagerankOptions,
  pagerank,
  defaultOptions,
} from "./algorithm/pagerank";

export type CredNode = {|
  +node: Node,
  +weight: NodeWeight,
  +cred: number,
|};

export type CredEdge = {|
  +edge: Edge,
  +weight: EdgeWeight,
  //+normalizedWeight: EdgeWeight,
  //+credFlow: EdgeWeight,
|};

export type CredNeighbor = {|
  +node: CredNode,
  +edge: CredEdge,
  //+cred: number,
|};

export class CredGraph {
  _wg: WeightedGraphT;
  _options: PagerankOptions;
  _scores: Map<NodeAddressT, number>;

  constructor(
    wg: WeightedGraphT,
    options: PagerankOptions,
    scores: Map<NodeAddressT, number>
  ) {
    this._wg = wg;
    this._options = options;
    this._scores = scores;
  }

  graph(): Graph {
    return this._wg.graph;
  }

  weightedGraph(): WeightedGraphT {
    return this._wg;
  }

  *nodes(options?: {|+prefix: NodeAddressT|}): Iterator<CredNode> {
    const nwe = nodeWeightEvaluator(this.weightedGraph().weights);
    for (const node of this.graph().nodes(options)) {
      const cred = NullUtil.get(this._scores.get(node.address));
      const weight = nwe(node.address);
      yield {node, cred, weight};
    }
  }

  *edges(options: EdgesOptions): Iterator<CredEdge> {
    const ewe = edgeWeightEvaluator(this.weightedGraph().weights);
    for (const edge of this.graph().edges(options)) {
      const weight = ewe(edge.address);
      yield {weight, edge};
    }
  }

  static async compute(
    wg: WeightedGraphT,
    scoringPrefixes: $ReadOnlyArray<NodeAddressT>,
    options: $Shape<PagerankOptions>
  ): Promise<CredGraph> {
    options = defaultOptions(options);
    const scores = await pagerank(wg, scoringPrefixes, options);
    return new CredGraph(wg, options, scores);
  }
}
