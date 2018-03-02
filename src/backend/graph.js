// @flow

export type Address = {
  repositoryName: string,
  pluginName: string,
  id: string,
};

export type Node<T> = {|
  address: Address,
  payload: T,
|};

export type Edge<T> = {|
  address: Address,
  src: Address,
  dst: Address,
  payload: T,
|};

export class Graph {
  _nodes: {[nodeAddress: string]: Node<mixed>};
  _edges: {[edgeAddress: string]: Edge<mixed>};

  // The keyset of each of the following fields should equal the keyset
  // of `_nodes`. If `e` is an edge from `u` to `v`, then `e.address`
  // should appear exactly once in `_outEdges[u.address]` and exactly
  // once in `_inEdges[v.address]` (and every entry in `_inEdges` and
  // `_outEdges` should be of this form).
  _outEdges: {[nodeAddress: string]: Address[]};
  _inEdges: {[nodeAddress: string]: Address[]};

  constructor() {
    this._nodes = {};
    this._edges = {};
    this._outEdges = {};
    this._inEdges = {};
  }

  addNode(node: Node<mixed>) {
    if (this.getNode(node.address) !== undefined) {
      throw new Error(
        `node at address ${JSON.stringify(node.address)} already exists`
      );
    }
    const addressString = addressToString(node.address);
    this._nodes[addressString] = node;
    this._outEdges[addressString] = [];
    this._inEdges[addressString] = [];
    return this;
  }

  addEdge(edge: Edge<mixed>) {
    if (this.getEdge(edge.address) !== undefined) {
      throw new Error(
        `edge at address ${JSON.stringify(edge.address)} already exists`
      );
    }
    if (this.getNode(edge.src) === undefined) {
      throw new Error(`source ${JSON.stringify(edge.src)} does not exist`);
    }
    if (this.getNode(edge.dst) === undefined) {
      throw new Error(`source ${JSON.stringify(edge.dst)} does not exist`);
    }
    this._edges[addressToString(edge.address)] = edge;
    this._outEdges[addressToString(edge.src)].push(edge.address);
    this._inEdges[addressToString(edge.dst)].push(edge.address);
    return this;
  }

  getNode(address: Address): Node<mixed> {
    return this._nodes[addressToString(address)];
  }

  getEdge(address: Address): Edge<mixed> {
    return this._edges[addressToString(address)];
  }

  /**
   * Gets the array of all out-edges from the node at the given address.
   * The order of the resulting array is unspecified.
   */
  getOutEdges(nodeAddress: Address): Edge<mixed>[] {
    const addresses = this._outEdges[addressToString(nodeAddress)];
    if (addresses === undefined) {
      throw new Error(`no node for address ${JSON.stringify(nodeAddress)}`);
    }
    return addresses.map((e) => this.getEdge(e));
  }

  /**
   * Gets the array of all in-edges to the node at the given address.
   * The order of the resulting array is unspecified.
   */
  getInEdges(nodeAddress: Address): Edge<mixed>[] {
    const addresses = this._inEdges[addressToString(nodeAddress)];
    if (addresses === undefined) {
      throw new Error(`no node for address ${JSON.stringify(nodeAddress)}`);
    }
    return addresses.map((e) => this.getEdge(e));
  }
}

export function addressToString(address: Address) {
  if (address.repositoryName.includes("$")) {
    const escaped = JSON.stringify(address.repositoryName);
    throw new Error(`address.repositoryName must not include "\$": ${escaped}`);
  }
  if (address.pluginName.includes("$")) {
    const escaped = JSON.stringify(address.pluginName);
    throw new Error(`address.pluginName must not include "\$": ${escaped}`);
  }
  if (address.id.includes("$")) {
    const escaped = JSON.stringify(address.id);
    throw new Error(`address.id must not include "\$": ${escaped}`);
  }
  return `${address.repositoryName}\$${address.pluginName}\$${address.id}`;
}

export function stringToAddress(string: string) {
  const parts = string.split("$");
  if (parts.length !== 3) {
    const escaped = JSON.stringify(string);
    throw new Error(`Input should have exactly two \$s: ${escaped}`);
  }
  return {
    repositoryName: parts[0],
    pluginName: parts[1],
    id: parts[2],
  };
}
