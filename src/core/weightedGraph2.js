// @flow

export type WeightedNodeInput = {|
  +node: GraphNode,
  // The weight that should be associated with this node's address.
  // It's optional (and implicitly defaults to 1).
  // Note that it's not guaranteed that the WeightedNode will have
  // this weight, because the WeightedNode's weight also depends on
  // prefix matching weights
  +ownWeight: ?number,
|};
export type WeightedNode = {|
  +node: GraphNode,
  // Evaluated weight for this node in the graph (including
  // prefix weighting)
  +weight: number,
|};

export class WeightedGraph2 {
  _graph: Graph;
  _nodeWeights: NodeTrie<NodeWeight>;
  _edgeWeights: EdgeTrie<EdgeWeight>;

  constructor() {
    this._graph = new Graph();
    this._nodeWeights = new NodeTrie();
    this._edgeWeights = new EdgeTrie();
  }

  addNode(x: WeightedNodeInput): this {
    this._graph.addNode(x.node);
    if (x.weight != null) {
      this.setNodeWeight(x.node.address, x.weight);
    }
  }

  // Can re-assign the weight for a specific node address. There
  // need not be any node at this address, in which case the weight
  // will act as a prefix weight (i.e. every node that has this address
  // as a prefix will be re-weighted).
  setNodeWeight(address: NodeAddressT, weight: NodeWeight): this {
    this._nodeWeights.add(address, weight);
  }

  _nodeWeight(address: NodeAddressT): NodeWeight {
    return this._nodeWeights.reduce((a, b) => a * b, 1);
  }

  node(address: NodeAddressT): WeightedNode | null {
    const graphNode = this._graph.node(address);
    if (graphNode == null) {
      return null;
    }
    return {node: graphNode, weight: this._nodeWeight(address)};
  }

  *nodes(options?: {|+prefix: NodeAddressT|}): Iterator<WeightedNode> {
    for (const node of this._graph.nodes(options)) {
      yield {node, weight: this._nodeWeight(address)};
    }
  }
}
