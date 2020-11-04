// @flow

import deepEqual from "lodash.isequal";
import deepFreeze from "deep-freeze";

import {makeAddressModule, type AddressModule} from "./address";
import {toCompat, fromCompat, type Compatible} from "../util/compat";
import * as NullUtil from "../util/null";
import {type TimestampMs} from "../util/timestamp";

/**
 * This module contains the Graph, which is one of the most fundamental pieces
 * of SourceCred. SourceCred uses this graph to model all of the contributions
 * that make up a project, and the relationships between those contributions.
 *
 * If you aren't familiar with computer science graphs, now would be a good
 * time to refresh. See [this StackOverflow answer][1] for an introduction, and
 * [Wikipedia][2] for a more thorough overview. This Graph is used by
 * SourceCred as a "Contribution Graph", where every node is a contribution or
 * contributor (e.g. a pull request, or a GitHub user identity) and every edge
 * represents a connection between contributions or contributors (e.g. a pull
 * request contains a comment, or a comment is authored by a user).
 *
 * [1]: https://softwareengineering.stackexchange.com/questions/168058/what-are-graphs-in-laymens-terms#168067
 * [2]: https://en.wikipedia.org/wiki/Graph_(abstract_data_type)
 *
 * The Graph serves a simple function: it keeps track of which Nodes exist, and
 * what Edges join those nodes to each other. Nodes and Edges are both identified
 * by Addresses; specifically, `NodeAddressT`s and `EdgeAddressT`s.
 *
 * In both cases, addresses are modeled as arrays of strings. For example,
 * you might want to give an address to your favorite node. You can do so as
 * follows:
 *
 * const myAddress: NodeAddressT = NodeAddress.fromParts(["my", "favorite"])
 *
 * Edge Addresses are quite similar, except you use the EdgeAddress module.
 *
 * We model addresses as arrays of strings so that plugins can apply
 * hierarchical namespacing for the address. In general, for any address, the
 * first piece should be the name of the organization that owns the plugin, and
 * the second piece should be the name of the plugin. Pieces thereafter are
 * namespaced by the plugin's internal logic. For example, SourceCred has a
 * Git plugin, and that plugin produces addresses like
 * ["sourcecred", "git", "commit", "9cba0e9e212a287ce26e8d7c2d273e1025c9f9bf"].
 *
 * This enables "prefix matching" for finding only certain types of nodes. For
 * example, if we wanted to find every Git commit in the graph, we
 * could use the following code:
 *
 * const commitPrefix = NodeAddress.fromParts(["sourcecred", "git", "commit"]);
 * const commitNodes = graph.nodes({prefix: commitPrefix});
 *
 * The graph represents nodes as the `Node` data type, which includes an
 * address (NodeAddressT) as well as a few other fields that are needed for
 * calculating and displaying cred. The Graph is intended to be a lightweight
 * data structure, so only data directly needed for cred analysis is included.
 * If there's other data you want to store (e.g. the full text of posts that
 * are tracked in the graph), you can use the node address as a key for a
 * separate database.
 *
 * Edges are represented by `Edge` objects. They have `src` and `dst` fields.
 * These fields represent the "source" of the edge and the "destination" of the
 * edge respectively, and both fields contain `NodeAddressT`s. The edge also
 * has its own address, which is an `EdgeAddressT`.
 *
 * Graphs are allowed to contain Edges whose `src` or `dst` are not present.
 * Such edges are called 'Dangling Edges'. An edge may convert from dangling to
 * non-dangling (if it is added before its src or dst), and it may convert from
 * non-dangling to dangling (if its src or dst are removed).
 *
 * Supporting dangling edges is important, because it means that we can require
 * metadata be present for a Node (e.g. its creation timestamp), and still
 * allow graph creators that do not know a node's metadata to create references
 * to it. (Of course, they still need to know the node's address).
 *
 * Here's a toy example of creating a graph:
 *
 * ```js
 * const prAddress = NodeAddress.fromParts(["pull_request", "1"]);
 * const prDescription = "My Fancy Pull Request"
 * const pr: Node = {address: prAddress, description: prDescription, timestampMs: +Date.now()}
 * const myAddress = NodeAddress.fromParts(["user", "decentralion"]);
 * const myDescription = "@decentralion"
 * const me: Node = {addess: myAddress, description: myDescription, timestampMs: null}
 * const authoredAddress = EdgeAddress.fromParts(["authored", "pull_request", "1"]);
 * const edge = {src: me, dst: pr, address: authoredAddress, timestampMs: +Date.now()};
 *
 * const g = new Graph();
 * g.addNode(pr);
 * g.addNode(me);
 * g.addEdge(edge);
 * ```
 *
 * Graph has a number of accessor methods:
 * - `hasNode` to check if a node address is in the Graph
 * - `node` to retrieve a node by its address
 * - `nodes` to iterate over the nodes in the graph
 * - `hasEdge` to check if an edge address is in the Graph
 * - `isDanglingEdge` to check if an edge is dangling
 * - `edge` to retrieve an edge by its address
 * - `edges` to iterate over the edges in the graph
 * - `neighbors` to find all the edges and nodes adjacent to a node
 *    (also supports filtering by direction, by node prefix, or edge prefix)
 *
 * The Graph also has a few other convenience methods, like toJSON/fromJSON
 * for serialization, and `Graph.merge` for combining multiple graphs.
 */
export opaque type NodeAddressT: string = string;
export opaque type EdgeAddressT: string = string;
export const NodeAddress: AddressModule<NodeAddressT> = (makeAddressModule({
  name: "NodeAddress",
  nonce: "N",
  otherNonces: new Map().set("E", "EdgeAddress"),
}): AddressModule<string>);
export const EdgeAddress: AddressModule<EdgeAddressT> = (makeAddressModule({
  name: "EdgeAddress",
  nonce: "E",
  otherNonces: new Map().set("N", "NodeAddress"),
}): AddressModule<string>);

/**
 * Represents a node in the graph.
 */
export type Node = {|
  +address: NodeAddressT,
  // Brief (ideally oneline) description for the node.
  // Markdown is supported.
  +description: string,
  // When this node was created.
  // Should be null for a "timeless" node, where we don't
  // want to model that node as having been created at any particular
  // point in time. User nodes are a good example of this.
  +timestampMs: TimestampMs | null,
|};

/**
 * An edge between two nodes.
 */
export type Edge = {|
  +address: EdgeAddressT,
  +src: NodeAddressT,
  +dst: NodeAddressT,
  +timestampMs: TimestampMs,
|};

const COMPAT_INFO = {type: "sourcecred/graph", version: "0.8.0"};

export type Neighbor = {|+node: Node, +edge: Edge|};

export opaque type DirectionT = symbol;
export const Direction: {|
  +IN: DirectionT,
  +OUT: DirectionT,
  +ANY: DirectionT,
|} = deepFreeze({
  IN: Symbol("IN"),
  OUT: Symbol("OUT"),
  ANY: Symbol("ANY"),
});

export type NeighborsOptions = {|
  +direction: DirectionT,
  +nodePrefix: NodeAddressT,
  +edgePrefix: EdgeAddressT,
|};

export type EdgesOptions = {|
  // An edge address prefix. Only show edges whose addresses match this prefix.
  +addressPrefix?: EdgeAddressT,
  // A node address prefix. Only show edges whose src matches
  // this prefix.
  +srcPrefix?: NodeAddressT,
  // A node address prefix. Only show edges whose dst matches
  // this prefix.
  +dstPrefix?: NodeAddressT,
  // Determines whether dangling edges should be included in the results.
  +showDangling: boolean,
|};

type AddressJSON = string[]; // Result of calling {Node,Edge}Address.toParts
type Integer = number;
type IndexedNodeJSON = {|
  +index: Integer,
  +description: string,
  +timestampMs: TimestampMs | null,
|};
type IndexedEdgeJSON = {|
  +address: AddressJSON,
  +srcIndex: Integer,
  +dstIndex: Integer,
  +timestampMs: TimestampMs,
|};

export type GraphJSON = Compatible<{|
  // A node address can be present because it corresponds to a node, or because
  // it is referenced by a dangling edge.
  +sortedNodeAddresses: AddressJSON[],
  +nodes: IndexedNodeJSON[],
  +edges: IndexedEdgeJSON[],
|}>;

export type ModificationCount = number;

// Internal-only type used to cache the sorted node and edge address order.
// The modification count is used as the cache key.
type CachedOrder = {|
  +nodeOrder: $ReadOnlyArray<NodeAddressT>,
  +edgeOrder: $ReadOnlyArray<EdgeAddressT>,
  +modificationCount: number,
|};

/**
 * Specifies how to contract a graph, collapsing several old nodes
 * into a single new node, and re-writing edges for consistency.
 */
export type NodeContraction = {|
  +old: $ReadOnlyArray<NodeAddressT>,
  +replacement: Node,
|};

export class Graph {
  _nodes: Map<NodeAddressT, Node>;
  _edges: Map<EdgeAddressT, Edge>;
  // Map every node address present in the graph to its inEdges (edges for
  // which it is a dst) and outEdges (edges for which it is a src)
  _incidentEdges: Map<NodeAddressT, {|+inEdges: Edge[], +outEdges: Edge[]|}>;

  // Incremented each time that any change is made to the graph. Used to
  // check for comodification and to avoid needlessly checking
  // invariants.
  _modificationCount: ModificationCount;
  _cachedOrder: CachedOrder;
  _invariantsLastChecked: {|+when: ModificationCount, +failure: ?string|};

  constructor(): void {
    this._modificationCount = 0;
    this._invariantsLastChecked = {
      when: -1,
      failure: "Invariants never checked",
    };
    this._cachedOrder = {
      nodeOrder: [],
      edgeOrder: [],
      modificationCount: 0,
    };
    this._nodes = new Map();
    this._edges = new Map();
    this._incidentEdges = new Map();
    this._maybeCheckInvariants();
  }

  _checkForComodification(since: ModificationCount) {
    // TODO(perf): Consider eliding this in production.
    const now = this._modificationCount;
    if (now === since) {
      this._maybeCheckInvariants();
      return;
    }
    if (now > since) {
      throw new Error("Concurrent modification detected");
    }
    if (now < since) {
      throw new Error(
        "Invariant violation: expected modification count in the future"
      );
    }
    this._maybeCheckInvariants();
  }

  _markModification() {
    // TODO(perf): Consider eliding this in production.
    if (this._modificationCount >= Number.MAX_SAFE_INTEGER) {
      throw new Error(
        `Graph cannot be modified more than ${this._modificationCount} times.`
      );
    }
    this._modificationCount++;
    this._maybeCheckInvariants();
  }

  /**
   * A node address is 'referenced' if it is either present in the graph, or is
   * the src or dst of some edge.
   *
   * Referenced nodes always have an entry in this._incidentEdges (regardless
   * of whether they are incident to any edges).
   *
   * This method ensures that a given node address has a reference.
   */
  _reference(n: NodeAddressT) {
    if (!this._incidentEdges.has(n)) {
      this._incidentEdges.set(n, {inEdges: [], outEdges: []});
    }
  }

  /**
   * A node stops being referenced as soon as it is both not in the graph, and is
   * not incident to any edge. This method must be called after any operation which
   * might cause a node address to no longer be referenced, so that the node can
   * be unreferenced if appropriate.
   */
  _unreference(n: NodeAddressT) {
    const incidence = this._incidentEdges.get(n);
    if (incidence != null) {
      const {inEdges, outEdges} = incidence;
      if (
        !this._nodes.has(n) &&
        inEdges.length === 0 &&
        outEdges.length === 0
      ) {
        this._incidentEdges.delete(n);
      }
    }
  }

  _getOrder(): CachedOrder {
    const modificationCount = this._modificationCount;
    if (this._cachedOrder.modificationCount !== modificationCount) {
      const edgeOrder = Array.from(this._edges.keys()).sort();
      const nodeOrder = Array.from(this._nodes.keys()).sort();
      this._cachedOrder = {nodeOrder, edgeOrder, modificationCount};
    }
    return this._cachedOrder;
  }

  /**
   * Returns how many times the graph has been modified.
   *
   * This value is exposed so that users of Graph can cache computations over
   * the graph with confidence, knowing that they will be able to check the
   * modification count to know when their cache is potentially invalid.
   *
   * This value may increase any time the graph is potentially modified, even
   * if no modification actually occurs; for example, if a client calls
   * `addNode`, the modification count may increase even if the added node was
   * already present in the graph.
   *
   * This value is not serialized, and is ignored when checking equality, i.e.
   * two graphs may be semantically equal even when they have different
   * modification counts.
   */
  modificationCount(): ModificationCount {
    return this._modificationCount;
  }

  /**
   * Adds a new node to the graph.
   *
   * If the node already exists in the graph, no action is taken and no error
   * is thrown. (This operation is idempotent).
   *
   * Returns `this` for chaining.
   */
  addNode(node: Node): this {
    const {address} = node;
    NodeAddress.assertValid(address);
    this._reference(address);
    const existingNode = this._nodes.get(address);
    if (existingNode == null) {
      this._nodes.set(address, node);
    } else {
      if (!deepEqual(node, existingNode)) {
        const strNode = nodeToString(node);
        const strExisting = nodeToString(existingNode);
        throw new Error(
          `conflict between new node ${strNode} and existing ${strExisting}`
        );
      }
    }
    this._markModification();
    this._maybeCheckInvariants();
    return this;
  }

  /**
   * Remove a node from the graph.
   *
   * If the node does not exist in the graph, no action is taken and no error
   * is thrown. (This operation is idempotent.)
   *
   * Removing a node which is incident to some edges is allowed; such edges will
   * become dangling edges. See the discussion of 'Dangling Edges' in the module docstring
   * for details.
   *
   * Returns `this` for chaining.
   */
  removeNode(a: NodeAddressT): this {
    NodeAddress.assertValid(a);
    this._nodes.delete(a);
    this._unreference(a);
    this._markModification();
    this._maybeCheckInvariants();
    return this;
  }

  /**
   * Test whether there exists a Node corresponding to the given NodeAddress.
   *
   * This will return false for node addresses which are referenced by some
   * edge, but not actually present in the graph.
   */
  hasNode(a: NodeAddressT): boolean {
    NodeAddress.assertValid(a);
    const result = this._nodes.has(a);
    this._maybeCheckInvariants();
    return result;
  }

  /**
   * Returns the Node matching a given NodeAddressT, if such a node exists,
   * or undefined otherwise.
   */
  node(address: NodeAddressT): ?Node {
    NodeAddress.assertValid(address);
    const result = this._nodes.get(address);
    this._maybeCheckInvariants();
    return result;
  }

  /**
   * Returns an iterator over all of the nodes in the graph.
   *
   * Optionally, the caller can provide a node prefix. If
   * provided, the iterator will only contain nodes matching that
   * prefix. See semantics of [Address.hasPrefix][1] for details.
   *
   * Clients must not modify the graph during iteration. If they do so, an
   * error may be thrown at the iteration call site.
   *
   * Nodes are yielded in address-sorted order.
   *
   * [1]: https://github.com/sourcecred/sourcecred/blob/7c7fa2d83d4fd5ba38efb2b2f4e0244235ac1312/src/core/address.js#L74
   */
  nodes(options?: {|+prefix: NodeAddressT|}): Iterator<Node> {
    const prefix = options != null ? options.prefix : NodeAddress.empty;
    if (prefix == null) {
      throw new Error(`Invalid prefix: ${String(prefix)}`);
    }
    const result = this._nodesIterator(this._modificationCount, prefix);
    this._maybeCheckInvariants();
    return result;
  }

  *_nodesIterator(
    initialModificationCount: ModificationCount,
    prefix: NodeAddressT
  ): Iterator<Node> {
    for (const address of this._getOrder().nodeOrder) {
      if (NodeAddress.hasPrefix(address, prefix)) {
        const node = NullUtil.get(this._nodes.get(address));
        this._checkForComodification(initialModificationCount);
        this._maybeCheckInvariants();
        yield node;
      }
    }
    this._checkForComodification(initialModificationCount);
    this._maybeCheckInvariants();
  }

  /**
   * Add an edge to the graph.
   *
   * It is permitted to add an edge if its src or dst are not in the graph. See
   * the discussion of 'Dangling Edges' in the module docstring for semantics.
   *
   * It is an error to add an edge if a distinct edge with the same address
   * already exists in the graph (i.e., if the source or destination are
   * different).
   *
   * Adding an edge that already exists to the graph is a no-op. (This
   * operation is idempotent.)
   *
   * Returns `this` for chaining.
   */
  addEdge(edge: Edge): this {
    NodeAddress.assertValid(edge.src, "edge.src");
    NodeAddress.assertValid(edge.dst, "edge.dst");
    EdgeAddress.assertValid(edge.address, "edge.address");

    this._reference(edge.src);
    this._reference(edge.dst);
    const existingEdge = this._edges.get(edge.address);
    if (existingEdge != null) {
      if (
        existingEdge.src !== edge.src ||
        existingEdge.dst !== edge.dst ||
        existingEdge.address !== edge.address ||
        existingEdge.timestampMs !== edge.timestampMs
      ) {
        const strEdge = edgeToString(edge);
        const strExisting = edgeToString(existingEdge);
        throw new Error(
          `conflict between new edge ${strEdge} and existing ${strExisting}`
        );
      }
    } else {
      this._edges.set(edge.address, edge);
      const {inEdges} = NullUtil.get(this._incidentEdges.get(edge.dst));
      const {outEdges} = NullUtil.get(this._incidentEdges.get(edge.src));
      inEdges.push(edge);
      outEdges.push(edge);
    }
    this._edges.set(edge.address, edge);
    this._markModification();
    this._maybeCheckInvariants();
    return this;
  }

  /**
   * Remove an edge from the graph.
   *
   * Calling removeEdge on an address that does not correspond to any edge in
   * the graph is a no-op. (This method is idempotent.)
   *
   * Returns `this` for chaining.
   */
  removeEdge(address: EdgeAddressT): this {
    EdgeAddress.assertValid(address);
    const edge = this._edges.get(address);
    if (edge != null) {
      this._edges.delete(address);
      const {inEdges} = NullUtil.get(this._incidentEdges.get(edge.dst));
      const {outEdges} = NullUtil.get(this._incidentEdges.get(edge.src));
      // TODO(perf): This is linear in the degree of the endpoints of the
      // edge. Consider storing in non-list form (e.g., `inEdges` and
      // `outEdges` fields in `_incidentEdges` could be `Set<EdgeAddressT>`).
      [inEdges, outEdges].forEach((edges) => {
        const index = edges.findIndex((edge) => edge.address === address);
        if (index === -1) {
          const strAddress = EdgeAddress.toString(address);
          throw new Error(
            `Invariant violation when removing edge@${strAddress}`
          );
        }
        edges.splice(index, 1);
      });
      this._unreference(edge.src);
      this._unreference(edge.dst);
    }
    this._markModification();
    this._maybeCheckInvariants();
    return this;
  }

  /**
   * Test whether the graph contains an edge with the given address.
   */
  hasEdge(address: EdgeAddressT): boolean {
    EdgeAddress.assertValid(address);
    const result = this._edges.has(address);
    this._maybeCheckInvariants();
    return result;
  }

  /**
   * Test whether there is a dangling edge at the given address.
   *
   * Returns true if the edge is present, and is dangling.
   * Returns false if the edge is present, and is not dangling.
   * Returns undefined if the edge is not present.
   *
   * See the module docstring for more details on dangling edges.
   */
  isDanglingEdge(address: EdgeAddressT): boolean | typeof undefined {
    EdgeAddress.assertValid(address);
    const edge = this.edge(address);
    let result: boolean | typeof undefined;
    if (edge != null) {
      const {src, dst} = edge;
      result = !this.hasNode(src) || !this.hasNode(dst);
    }
    this._maybeCheckInvariants();
    return result;
  }

  /**
   * Returns the Edge matching a given EdgeAddressT, if such an edge exists, or
   * null otherwise.
   */
  edge(address: EdgeAddressT): ?Edge {
    EdgeAddress.assertValid(address);
    const result = this._edges.get(address);
    this._maybeCheckInvariants();
    return result;
  }

  /**
   * Returns an iterator over edges in the graph, optionally filtered by edge
   * address prefix, source address prefix, and/or destination address prefix.
   *
   * The caller must pass an options object with a boolean field `showDangling`,
   * which determines whether dangling edges will be included in the results.
   * The caller may also pass fields `addressPrefix`, `srcPrefix`, and `dstPrefix`
   * to perform prefix-based address filtering of edges that are returned.
   * (See the module docstring for more context on dangling edges.)
   *
   * Suppose that you want to find every edge that represents authorship by a
   * user. If all authorship edges have the `AUTHORS_EDGE_PREFIX` prefix, and
   * all user nodes have the `USER_NODE_PREFIX` prefix, then you could call:
   *
   * graph.edges({
   *  showDangling: true,  // or false, irrelevant for this example
   *  addressPrefix: AUTHORS_EDGE_PREFIX,
   *  srcPrefix: USER_NODE_PREFIX,
   * });
   *
   * In this example, as `dstPrefix` was left unset, it will default to
   * `NodeAddress.empty`, which is a prefix of every node address.
   *
   * Clients must not modify the graph during iteration. If they do so, an
   * error may be thrown at the iteration call site.
   *
   * The edges are yielded in sorted address order.
   */
  edges(options: EdgesOptions): Iterator<Edge> {
    if (options == null) {
      throw new Error("Options are required for Graph.edges");
    }
    const {showDangling} = options;
    const addressPrefix = NullUtil.orElse(
      options.addressPrefix,
      EdgeAddress.empty
    );
    const srcPrefix = NullUtil.orElse(options.srcPrefix, NodeAddress.empty);
    const dstPrefix = NullUtil.orElse(options.dstPrefix, NodeAddress.empty);

    const result = this._edgesIterator(
      this._modificationCount,
      showDangling,
      addressPrefix,
      srcPrefix,
      dstPrefix
    );
    this._maybeCheckInvariants();
    return result;
  }

  *_edgesIterator(
    initialModificationCount: ModificationCount,
    showDangling: boolean,
    addressPrefix: EdgeAddressT,
    srcPrefix: NodeAddressT,
    dstPrefix: NodeAddressT
  ): Iterator<Edge> {
    for (const address of this._getOrder().edgeOrder) {
      const edge = NullUtil.get(this._edges.get(address));
      if (
        (showDangling || this.isDanglingEdge(edge.address) === false) &&
        EdgeAddress.hasPrefix(edge.address, addressPrefix) &&
        NodeAddress.hasPrefix(edge.src, srcPrefix) &&
        NodeAddress.hasPrefix(edge.dst, dstPrefix)
      ) {
        this._checkForComodification(initialModificationCount);
        this._maybeCheckInvariants();
        yield edge;
      }
    }
    this._checkForComodification(initialModificationCount);
    this._maybeCheckInvariants();
  }

  /**
   * Find the `Neighbors` that are incident to a chosen root node.
   *
   * A `Neighbor` contains an edge that is incident to the root,
   * and the node at the other endpoint of the edge. This may be
   * either the source or destination of the edge, depending on whether the
   * edge is an in-edge or an out-edge from the perspective of the root. For
   * convenience, a `Neighbor` is thus an object that includes both the edge
   * and the adjacent node.
   *
   * Every non-dangling edge incident to the root corresponds to exactly one
   * neighbor, but note that multiple neighbors may have the same `node` in the
   * case that there are multiple edges with the same source and destination.
   *
   * Callers to `neighbors` must provide `NeighborsOptions` as follows:
   *
   * - direction: one of Direction.IN, direction.OUT, or Direction.ANY.
   *   - Direction.IN finds neigbhors where root is the destination of the
   *     edge.
   *   - Direction.OUT finds neigbhors where root is the source of the edge.
   *   - Direction.ANY finds neigbhors where root is the source or destination
   *     of the edge.
   *
   * - nodePrefix: A NodeAddressT to use as a prefix filter for the adjacent node.
   *   If you want all nodes, use `NodeAddress`.empty.
   *
   * - edgePrefix: An EdgeAddressT to use as a prefix filter for the edge.
   *   If you want all edges, use `EdgeAddress`.empty.
   *
   * Calling `neighbors` on a node that is not present in the graph is an error.
   *
   * If the root node has an edge for which it is both the source and the
   * destination (a loop edge), there will be one `Neighbor` with the root node
   * and the loop edge.
   *
   * No `Neighbors` will be created for dangling edges, as such edges do not
   * correspond to any Node in the graph.
   *
   * Clients must not modify the graph during iteration. If they do so, an
   * error may be thrown at the iteration call site. The iteration order is
   * undefined.
   */
  neighbors(node: NodeAddressT, options: NeighborsOptions): Iterator<Neighbor> {
    if (!this.hasNode(node)) {
      throw new Error(`Node does not exist: ${NodeAddress.toString(node)}`);
    }
    const result = this._neighbors(node, options, this._modificationCount);
    this._maybeCheckInvariants();
    return result;
  }

  *_neighbors(
    node: NodeAddressT,
    options: NeighborsOptions,
    initialModificationCount: ModificationCount
  ): Iterator<Neighbor> {
    const nodeFilter = (n) => NodeAddress.hasPrefix(n, options.nodePrefix);
    const edgeFilter = (e) => EdgeAddress.hasPrefix(e, options.edgePrefix);
    const direction = options.direction;
    const adjacencies: {edges: Edge[], direction: string}[] = [];
    if (direction === Direction.IN || direction === Direction.ANY) {
      const {inEdges} = NullUtil.get(this._incidentEdges.get(node));
      adjacencies.push({edges: inEdges, direction: "IN"});
    }
    if (direction === Direction.OUT || direction === Direction.ANY) {
      const {outEdges} = NullUtil.get(this._incidentEdges.get(node));
      adjacencies.push({edges: outEdges, direction: "OUT"});
    }

    for (const adjacency of adjacencies) {
      for (const edge of adjacency.edges) {
        if (direction === Direction.ANY && adjacency.direction === "IN") {
          if (edge.src === edge.dst) {
            continue; // don't yield loop edges twice.
          }
        }
        const neighborNodeAddress =
          adjacency.direction === "IN" ? edge.src : edge.dst;
        const neighborNode = this.node(neighborNodeAddress);
        if (
          nodeFilter(neighborNodeAddress) &&
          edgeFilter(edge.address) &&
          neighborNode != null
        ) {
          this._checkForComodification(initialModificationCount);
          this._maybeCheckInvariants();
          yield {edge, node: neighborNode};
        }
      }
    }
    this._checkForComodification(initialModificationCount);
    this._maybeCheckInvariants();
  }

  /**
   * Checks whether this graph is equal to another graph.
   *
   * Two Graphs are considered equal if they have identical sets of nodes
   * and edges. Insertion order is irrelevant.
   *
   * Runs in time `O(n + e)`, where `n` is the number of nodes and `e` is the
   * number of edges.
   */
  equals(that: Graph): boolean {
    if (!(that instanceof Graph)) {
      throw new Error(`Expected Graph, got ${String(that)}`);
    }
    const result =
      deepEqual(this._nodes, that._nodes) &&
      deepEqual(this._edges, that._edges);
    this._maybeCheckInvariants();
    return result;
  }

  /**
   * Produce a copy of this graph.
   *
   * The copy is equal to the original, but distinct, so that they may be
   * modified independently.
   */
  copy(): Graph {
    const result = Graph.merge([this]);
    this._maybeCheckInvariants();
    return result;
  }

  /**
   * Serialize a Graph into a plain JavaScript object.
   */
  toJSON(): GraphJSON {
    // Unlike Array.from(this.nodes()).map((x) => x.address), this will include
    // node references. Including node references is necessary so that we can
    // index edges' src and dst consistently, even for dangling edges.
    const sortedNodeAddresses = Array.from(this._incidentEdges.keys()).sort();
    const nodeAddressToSortedIndex = new Map();
    sortedNodeAddresses.forEach((address, i) => {
      nodeAddressToSortedIndex.set(address, i);
    });
    const sortedEdges = Array.from(this.edges({showDangling: true}));
    const indexedEdges: IndexedEdgeJSON[] = sortedEdges.map(
      ({src, dst, address, timestampMs}) => {
        const srcIndex = NullUtil.get(nodeAddressToSortedIndex.get(src));
        const dstIndex = NullUtil.get(nodeAddressToSortedIndex.get(dst));
        return {
          srcIndex,
          dstIndex,
          address: EdgeAddress.toParts(address),
          timestampMs,
        };
      }
    );
    const sortedNodes = Array.from(this.nodes());
    const indexedNodes: IndexedNodeJSON[] = sortedNodes.map(
      ({address, description, timestampMs}) => {
        const index = NullUtil.get(nodeAddressToSortedIndex.get(address));
        return {index, description, timestampMs};
      }
    );
    const rawJSON = {
      sortedNodeAddresses: sortedNodeAddresses.map((x) =>
        NodeAddress.toParts(x)
      ),
      edges: indexedEdges,
      nodes: indexedNodes,
    };
    const result = toCompat(COMPAT_INFO, rawJSON);
    this._maybeCheckInvariants();
    return result;
  }

  /**
   * Deserializes a GraphJSON into a new Graph.
   */
  static fromJSON(compatJson: GraphJSON): Graph {
    const {
      nodes: nodesJSON,
      edges: edgesJSON,
      sortedNodeAddresses: sortedNodeAddressesJSON,
    } = fromCompat(COMPAT_INFO, compatJson);
    const sortedNodeAddresses = sortedNodeAddressesJSON.map(
      NodeAddress.fromParts
    );
    const result = new Graph();
    nodesJSON.forEach((j: IndexedNodeJSON) => {
      const n: Node = {
        address: sortedNodeAddresses[j.index],
        description: j.description,
        timestampMs: j.timestampMs,
      };
      result.addNode(n);
    });
    edgesJSON.forEach(({address, srcIndex, dstIndex, timestampMs}) => {
      const src = sortedNodeAddresses[srcIndex];
      const dst = sortedNodeAddresses[dstIndex];
      result.addEdge({
        address: EdgeAddress.fromParts(address),
        src: src,
        dst: dst,
        timestampMs,
      });
    });
    return result;
  }

  /**
   * Compute the union of the given graphs. The result is a new graph that has
   * all of the nodes and all of the edges from all the provided graphs.
   *
   * If two of the given graphs have edges with the same address, the edges
   * must be equal (i.e. must have the same source and destination in each
   * graph). If this is not the case, an error will be thrown.
   *
   * Example usage:
   *
   * const g1 = new Graph().addNode(a).addNode(b).addEdge(e);
   * const g2 = new Graph().addNode(b).addNode(c).addEdge(f);
   * const g3 = Graph.merge([g1, g2]);
   * Array.from(g3.nodes()).length;  // 3
   * Array.from(g3.edges()).length;  // 2
   * const g1 = new Graph().addNode(a).addNode(b).addEdge(x);
   * const g2 = new Graph().addNode(c);
   * const g3 = Graph.merge([g1, g2]);
   *
   * The newly created graph is a separate instance from any of the input graphs,
   * and may be mutated independently.
   */
  static merge(graphs: Iterable<Graph>): Graph {
    const result = new Graph();
    for (const graph of graphs) {
      for (const node of graph.nodes()) {
        result.addNode(node);
      }
      for (const edge of graph.edges({showDangling: true})) {
        result.addEdge(edge);
      }
    }
    return result;
  }

  /**
   * Create a new graph, in which some nodes have been contracted together.
   *
   * contractNodes takes a list of NodeContractions, each of which specifies a
   * replacement node, and a list of old node addresses to map onto the new
   * node. A new graph will be returned where the new node is added, none of
   * the old nodes are present, and every edge incident to one of the old nodes
   * has been re-written so that it is incident to the new node instead.
   *
   * If the same node addresses is "old" for several contractions, all incident
   * edges will be re-written to connect to whichever contraction came last.
   *
   * If the replacement node is present in the graph, no error will be thrown,
   * provided that the replacement node is consistent with the one in the graph.
   *
   * If there is a "chain" of remaps (i.e. a->b and b->c), then an error will
   * be thrown, as support for chaining has not yet been implemented.
   *
   * The original Graph is not mutated.
   *
   * contractNodes runs in O(n+e+k), where `n` is the number of nodes, `e` is the
   * number of edges, and `k` is the number of contractions. If needed, we can
   * improve the peformance by mutating the original graph instead of creating
   * a new one.
   */
  contractNodes(contractions: $ReadOnlyArray<NodeContraction>): Graph {
    const remap = new Map();
    const replacements = new Set();
    const contracted = new Graph();
    for (const {old, replacement} of contractions) {
      for (const addr of old) {
        if (replacements.has(addr)) {
          throw new Error(
            `Chained contractions are not supported: ${NodeAddress.toString(
              addr
            )}`
          );
        }
        remap.set(addr, replacement.address);
      }
      replacements.add(replacement.address);
      contracted.addNode(replacement);
    }
    for (const node of this.nodes()) {
      if (!remap.has(node.address)) {
        contracted.addNode(node);
      }
    }
    for (const edge of this.edges({showDangling: true})) {
      const src = NullUtil.orElse(remap.get(edge.src), edge.src);
      const dst = NullUtil.orElse(remap.get(edge.dst), edge.dst);
      const newEdge = {...edge, src, dst};
      contracted.addEdge(newEdge);
    }
    return contracted;
  }

  checkInvariants() {
    if (this._invariantsLastChecked.when !== this._modificationCount) {
      let failure: ?string = null;
      try {
        this._checkInvariants();
      } catch (e) {
        failure = e.message;
      } finally {
        this._invariantsLastChecked = {
          when: this._modificationCount,
          failure,
        };
      }
    }
    if (this._invariantsLastChecked.failure != null) {
      throw new Error(this._invariantsLastChecked.failure);
    }
  }

  _checkInvariants() {
    // Definition. A node `n` is in the graph if `n` is deep-equal to
    // `_nodes.get(n.address)`.
    //
    // Definition. An edge `e` is in the graph if `e` is deep-equal to
    // `_edges.get(e.address)`.
    //
    // Definition. A *logical value* is an equivalence class of ECMAScript
    // values modulo deep equality (or, from context, an element of such a
    // class).

    // Invariant 1. A node address `na` is 'referenced' if `_incidentEdges.has(na)`.
    // 1.1 If a node is in the graph, then it is referenced by its address.
    // 1.2 If a node has any incident edge, then it is referenced.
    // 1.3 If a node is not in the graph and does not have incident edges, then
    // it is not referenced.
    const referencedNodesEncountered = new Set();
    // 1.1
    for (const [address, node] of this._nodes) {
      if (node.address !== address) {
        throw new Error(
          `bad node address for ${NodeAddress.toString(address)}`
        );
      }
      if (!this._incidentEdges.has(address)) {
        throw new Error(
          `missing incident-edges for ${NodeAddress.toString(address)}`
        );
      }
      referencedNodesEncountered.add(address);
    }
    // 1.2
    for (const edge of this._edges.values()) {
      if (!this._incidentEdges.has(edge.src)) {
        throw new Error(
          `missing incident-edges for src of: ${edgeToString(edge)}`
        );
      }
      referencedNodesEncountered.add(edge.src);
      if (!this._incidentEdges.has(edge.dst)) {
        throw new Error(
          `missing incident-edges for dst of: ${edgeToString(edge)}`
        );
      }
      referencedNodesEncountered.add(edge.dst);
    }
    // Check 1.3 by implication: for every address in
    // referencedNodesEncountered, we've explicitly checked that it is present
    // in _incidentEdges.
    //
    // Therefore, if the number of keys in _incidentEdges differs from the
    // number of elements in referencedNodesEncountered, it must be because
    // some elements in _incidentEdges were not present in
    // referencedNodesEncountered, which means that they did not correspond to
    // a node in the graph and did not have incident edges.
    const numIncidentEntries = Array.from(this._incidentEdges.keys()).length;
    if (numIncidentEntries !== referencedNodesEncountered.size) {
      throw new Error("extra addresses in incident-edges");
    }

    // Invariant 2. For an edge address `a`, if `_edges.has(a)` and
    // `_edges.get(a) === e`, then:
    //  1. `e.address` equals `a`;
    //  2. `e.src` is referenced;
    //  3. `e.dst` is referenced;
    //  4. `_incidentEdges.get(e.dst).inEdges` contains `e`; and
    //  5. `_incidentEdges.get(e.src).outEdges` contains `e`.
    //
    // 2.2 and 2.3 are implied by 2.4 and 2.5 respectively (as a node's address
    // being available in _incidentEdges means that it is referenced). So we may
    // ignore them.
    //
    // We check 2.1 here, and check 2.4 and 2.5 later for improved performance.
    for (const [address, edge] of this._edges.entries()) {
      if (edge.address !== address) {
        throw new Error(
          `bad edge address: ${edgeToString(edge)} does not match ${address}`
        );
      }
    }

    // Invariant 3. Suppose that `_incidentEdges.has(n)` and, let `es` be
    // `_incidentEdges.get(n).inEdges`. Then
    //  1. `es` contains any logical value at most once;
    //  2. if `es` contains `e`, then `e` is in the graph; and
    //  3. if `es` contains `e`, then `e.dst === n`.
    //
    // Invariant 4. Suppose that `_incidentEdges.has(n)` and, let `es` be
    // `_incidentEdges.get(n).outEdges`. Then
    //  1. `es` contains any logical value at most once;
    //  2. if `es` contains `e`, then `e` is in the graph; and
    //  3. if `es` contains `e`, then `e.src === n`.
    //
    // Note that Invariant 3.1 is equivalent to the following:
    //
    //     Invariant 3.1*. If `a` is an address, then there is at most
    //     one index `i` such that `es[i].address` is `a`.
    //
    // It is immediate that 3.1* implies 3.1. To see that 3.1 implies
    // 3.1*, suppose that `i` and `j` are such that `es[i].address` and
    // `es[j].address` are both `a`. Then, by Invariant 3.2, each of
    // `es[i]` and `es[j]` is in the graph, so each is deep-equal to
    // `_edges.get(a)`. Therefore, `es[i]` and `es[j]` are deep-equal to
    // each other. By 3.1, `es` contains a logical value at most once,
    // so `i` must be equal to `j`.
    //
    // Therefore, it is valid to verify that 3.1*, which we will do. The
    // same logic of course applies to Invariant 4.1.
    const inEdgesSeen: Set<EdgeAddressT> = new Set();
    const outEdgesSeen: Set<EdgeAddressT> = new Set();
    const incidentEntries = Array.from(this._incidentEdges.entries());
    for (const {seen, entries, baseNodeAccessor, kind} of [
      {
        seen: inEdgesSeen,
        entries: incidentEntries.map(([a, {inEdges}]) => [a, inEdges]),
        baseNodeAccessor: (e) => e.dst,
        kind: "in-edge",
      },
      {
        seen: outEdgesSeen,
        entries: incidentEntries.map(([a, {outEdges}]) => [a, outEdges]),
        baseNodeAccessor: (e) => e.src,
        kind: "out-edge",
      },
    ]) {
      for (const [base, edges] of entries) {
        for (const edge of edges) {
          // 3.1/4.1
          if (seen.has(edge.address)) {
            throw new Error(`duplicate ${kind}: ${edgeToString(edge)}`);
          }
          seen.add(edge.address);
          const expected = this._edges.get(edge.address);
          // 3.2/4.2
          if (!deepEqual(edge, expected)) {
            if (expected == null) {
              throw new Error(`spurious ${kind}: ${edgeToString(edge)}`);
            } else {
              const vs = `${edgeToString(edge)} vs. ${edgeToString(expected)}`;
              throw new Error(`bad ${kind}: ${vs}`);
            }
          }
          // 3.3/4.3
          const expectedBase = baseNodeAccessor(edge);
          if (base !== baseNodeAccessor(edge)) {
            throw new Error(
              `bad ${kind}: ${edgeToString(edge)} should be ` +
                `should be anchored at ${NodeAddress.toString(expectedBase)}`
            );
          }
        }
      }
    }

    // We now return to check 2.4 and 2.5, with the help of the
    // structures that we have built up in checking Invariants 3 and 4.
    for (const edge of this._edges.values()) {
      // That `_incidentEdges.get(n).inEdges` contains `e` for some `n` is
      // sufficient to show that `_incidentEdges.get(e.dst).inEdges` contains
      // `e`: if `n` were something other than `e.dst`, then we would have a
      // failure of invariant 3.3, which would have been caught earlier.
      // Likewise for outEdges.
      if (!inEdgesSeen.has(edge.address)) {
        throw new Error(`missing in-edge: ${edgeToString(edge)}`);
      }
      if (!outEdgesSeen.has(edge.address)) {
        throw new Error(`missing out-edge: ${edgeToString(edge)}`);
      }
    }
  }

  _maybeCheckInvariants() {
    if (process.env.NODE_ENV === "test") {
      // TODO(perf): If this method becomes really slow, we can disable
      // it on specific tests wherein we construct large graphs.
      this.checkInvariants();
    }
  }
}

/**
 * Convert a node into a human readable string.
 *
 * The precise behavior is an implementation detail and subject to change.
 */
export function nodeToString(node: Node): string {
  const address = NodeAddress.toString(node.address);
  return `{address: ${address}}`;
}

/**
 * Convert an edge into a human readable string.
 *
 * The precise behavior is an implementation detail and subject to change.
 */
export function edgeToString(edge: Edge): string {
  const address = EdgeAddress.toString(edge.address);
  const src = NodeAddress.toString(edge.src);
  const dst = NodeAddress.toString(edge.dst);
  return `{address: ${address}, src: ${src}, dst: ${dst}, timestampMs: ${edge.timestampMs}}`;
}

/**
 * Convert an edge to an object whose fields are human-readable.
 * This is useful for storing edges in human-readable formats that
 * should not include NUL characters, such as Jest snapshots.
 */
export function edgeToStrings(
  edge: Edge
): {|
  +address: string,
  +src: string,
  +dst: string,
  +timestampMs: TimestampMs,
|} {
  return {
    address: EdgeAddress.toString(edge.address),
    src: NodeAddress.toString(edge.src),
    dst: NodeAddress.toString(edge.dst),
    timestampMs: edge.timestampMs,
  };
}

export function edgeToParts(
  edge: Edge
): {|
  +addressParts: string[],
  +srcParts: string[],
  +dstParts: string[],
  +timestampMs: TimestampMs,
|} {
  const addressParts = EdgeAddress.toParts(edge.address);
  const srcParts = NodeAddress.toParts(edge.src);
  const dstParts = NodeAddress.toParts(edge.dst);
  const timestampMs = edge.timestampMs;
  return {addressParts, srcParts, dstParts, timestampMs};
}

export type GraphComparison = {|
  +graphsAreEqual: boolean,
  +uniqueNodesInFirst: $ReadOnlyArray<Node>,
  +uniqueNodesInSecond: $ReadOnlyArray<Node>,
  +nodeTuplesWithDifferences: $ReadOnlyArray<[Node, Node]>,
  +uniqueEdgesInFirst: $ReadOnlyArray<Edge>,
  +uniqueEdgesInSecond: $ReadOnlyArray<Edge>,
  +edgeTuplesWithDifferences: $ReadOnlyArray<[Edge, Edge]>,
|};

export function compareGraphs(
  firstGraph: Graph,
  secondGraph: Graph
): GraphComparison {
  const uniqueNodesInFirst = [];
  const uniqueNodesInSecond = [];
  const nodeTuplesWithDifferences = [];
  const uniqueEdgesInFirst = [];
  const uniqueEdgesInSecond = [];
  const edgeTuplesWithDifferences = [];
  const graphsAreEqual = firstGraph.equals(secondGraph);

  if (!graphsAreEqual) {
    for (const firstNode of firstGraph.nodes()) {
      const secondNode = secondGraph.node(firstNode.address);
      if (secondNode) {
        if (!deepEqual(firstNode, secondNode))
          nodeTuplesWithDifferences.push([firstNode, secondNode]);
      } else {
        uniqueNodesInFirst.push(firstNode);
      }
    }
    for (const secondNode of secondGraph.nodes()) {
      const firstNode = firstGraph.node(secondNode.address);
      if (!firstNode) {
        uniqueNodesInSecond.push(secondNode);
      }
    }

    for (const firstEdge of firstGraph.edges({showDangling: true})) {
      const secondEdge = secondGraph.edge(firstEdge.address);
      if (secondEdge) {
        if (!deepEqual(firstEdge, secondEdge))
          edgeTuplesWithDifferences.push([firstEdge, secondEdge]);
      } else {
        uniqueEdgesInFirst.push(firstEdge);
      }
    }
    for (const secondEdge of secondGraph.edges({showDangling: true})) {
      const firstEdge = firstGraph.edge(secondEdge.address);
      if (!firstEdge) {
        uniqueEdgesInSecond.push(secondEdge);
      }
    }
  }

  return {
    graphsAreEqual,
    uniqueNodesInFirst,
    uniqueNodesInSecond,
    nodeTuplesWithDifferences,
    uniqueEdgesInFirst,
    uniqueEdgesInSecond,
    edgeTuplesWithDifferences,
  };
}
