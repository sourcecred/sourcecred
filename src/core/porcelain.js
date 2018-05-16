// @flow

import type {Address} from "./address";
import type {Edge, Graph, Node} from "./graph";

export class NodeReference<+T> {
  _graph: Graph;
  _address: Address;

  constructor(g: Graph, a: Address) {
    this._graph = g;
    this._address = a;
  }

  neighbors(options?: {|
    +nodeType?: string,
    +edgeType?: string,
    +direction?: "IN" | "OUT" | "ANY",
  |}): {|+ref: NodeReference<any>, edge: Edge<any>|}[] {
    return this._graph
      .neighborhood(this._address, options)
      .map(({neighbor, edge}) => ({
        ref: new NodeReference(this._graph, neighbor),
        edge,
      }));
  }

  graph(): Graph {
    return this._graph;
  }

  address(): Address {
    return this._address;
  }

  type(): string {
    return this._address.type;
  }

  get(): ?NodePorcelain<T> {
    const node = this._graph.node(this._address);
    if (node != null) {
      return new NodePorcelain(this, node);
    }
  }
}

export class NodePorcelain<+T> {
  +_ref: NodeReference<T>;
  +_node: Node<T>;

  constructor(ref: NodeReference<T>, n: Node<T>) {
    this._ref = ref;
    this._node = n;
  }

  node(): Node<T> {
    return this._node;
  }

  payload(): T {
    return this._node.payload;
  }

  ref(): NodeReference<T> {
    return this._ref;
  }
}
