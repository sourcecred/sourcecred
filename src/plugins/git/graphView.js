// @flow

import {
  type EdgeAddressT,
  type NeighborsOptions,
  type NodeAddressT,
  Direction,
  Graph,
  NodeAddress,
  edgeToString,
} from "../../core/graph";

import * as GN from "./nodes";
import * as GE from "./edges";

export class GraphView {
  _graph: Graph;

  constructor(graph: Graph): void {
    this._graph = graph;
    this._maybeCheckInvariants();
  }

  *_neighbors<T: GN.StructuredAddress>(
    node: GN.StructuredAddress,
    options: NeighborsOptions
  ): Iterator<T> {
    if (!NodeAddress.hasPrefix(options.nodePrefix, GN._Prefix.base)) {
      throw new Error(`_neighbors must filter to Git nodes`);
    }
    const rawNode: GN.RawAddress = GN.toRaw(node);
    for (const neighbor of this._graph.neighbors(rawNode, options)) {
      this._maybeCheckInvariants();
      yield ((GN.fromRaw(
        (((neighbor.node: NodeAddressT): any): GN.RawAddress)
      ): any): T);
    }
    this._maybeCheckInvariants();
  }

  graph(): Graph {
    const result = this._graph;
    this._maybeCheckInvariants();
    return result;
  }

  commits(): Iterator<GN.CommitAddress> {
    const result = this._commits();
    this._maybeCheckInvariants();
    return result;
  }

  *_commits(): Iterator<GN.CommitAddress> {
    for (const node of this._graph.nodes({prefix: GN._Prefix.commit})) {
      const rawAddress: GN.RawAddress = ((node: NodeAddressT): any);
      const commit: GN.CommitAddress = (GN.fromRaw(rawAddress): any);
      this._maybeCheckInvariants();
      yield commit;
    }
    this._maybeCheckInvariants();
  }

  tree(commit: GN.CommitAddress): GN.TreeAddress {
    const result: GN.TreeAddress = Array.from(
      this._neighbors(commit, {
        direction: Direction.OUT,
        nodePrefix: GN._Prefix.tree,
        edgePrefix: GE._Prefix.hasTree,
      })
    )[0];
    this._maybeCheckInvariants();
    return result;
  }

  parents(commit: GN.CommitAddress): Iterator<GN.CommitAddress> {
    const result: Iterator<GN.CommitAddress> = this._neighbors(commit, {
      direction: Direction.OUT,
      nodePrefix: GN._Prefix.commit,
      edgePrefix: GE._Prefix.hasParent,
    });
    this._maybeCheckInvariants();
    return result;
  }

  entries(tree: GN.TreeAddress): Iterator<GN.TreeEntryAddress> {
    const result: Iterator<GN.TreeEntryAddress> = this._neighbors(tree, {
      direction: Direction.OUT,
      nodePrefix: GN._Prefix.treeEntry,
      edgePrefix: GE._Prefix.includes,
    });
    this._maybeCheckInvariants();
    return result;
  }

  contents(entry: GN.TreeEntryAddress): Iterator<GN.TreeEntryContentsAddress> {
    const result: Iterator<GN.TreeEntryContentsAddress> = this._neighbors(
      entry,
      {
        direction: Direction.OUT,
        nodePrefix: GN._Prefix.base, // multiple kinds
        edgePrefix: GE._Prefix.hasContents,
      }
    );
    this._maybeCheckInvariants();
    return result;
  }

  evolvesTo(entry: GN.TreeEntryAddress): Iterator<GN.TreeEntryAddress> {
    const result: Iterator<GN.TreeEntryAddress> = this._neighbors(entry, {
      direction: Direction.OUT,
      nodePrefix: GN._Prefix.treeEntry,
      edgePrefix: GE._Prefix.becomes,
    });
    this._maybeCheckInvariants();
    return result;
  }

  evolvesFrom(entry: GN.TreeEntryAddress): Iterator<GN.TreeEntryAddress> {
    const result: Iterator<GN.TreeEntryAddress> = this._neighbors(entry, {
      direction: Direction.IN,
      nodePrefix: GN._Prefix.treeEntry,
      edgePrefix: GE._Prefix.becomes,
    });
    this._maybeCheckInvariants();
    return result;
  }

  _maybeCheckInvariants() {
    if (process.env.NODE_ENV === "test") {
      // TODO(perf): If this method becomes really slow, we can disable
      // it on specific tests wherein we construct large graphs.
      this.checkInvariants();
    }
  }

  checkInvariants() {
    // All Git nodes and edges must have valid Git addresses.
    for (const node of this._graph.nodes({prefix: GN._Prefix.base})) {
      GN.fromRaw((((node: NodeAddressT): any): GN.RawAddress));
    }
    // (Edges are checked down below.)

    // All Git edges must have `src` and `dst` of specific types.
    type EdgeInvariant = {|
      +prefix: GE.RawAddress,
      +homs: $ReadOnlyArray<{|
        +srcPrefix: NodeAddressT,
        +dstPrefix: NodeAddressT,
      |}>,
    |};
    const edgeInvariants = {
      [GE.HAS_TREE_TYPE]: {
        prefix: GE._Prefix.hasTree,
        homs: [{srcPrefix: GN._Prefix.commit, dstPrefix: GN._Prefix.tree}],
      },
      [GE.HAS_PARENT_TYPE]: {
        prefix: GE._Prefix.hasParent,
        homs: [{srcPrefix: GN._Prefix.commit, dstPrefix: GN._Prefix.commit}],
      },
      [GE.INCLUDES_TYPE]: {
        prefix: GE._Prefix.includes,
        homs: [{srcPrefix: GN._Prefix.tree, dstPrefix: GN._Prefix.treeEntry}],
      },
      [GE.BECOMES_TYPE]: {
        prefix: GE._Prefix.becomes,
        homs: [
          {srcPrefix: GN._Prefix.treeEntry, dstPrefix: GN._Prefix.treeEntry},
        ],
      },
      [GE.HAS_CONTENTS_TYPE]: {
        prefix: GE._Prefix.hasContents,
        homs: [
          {srcPrefix: GN._Prefix.treeEntry, dstPrefix: GN._Prefix.blob},
          {srcPrefix: GN._Prefix.treeEntry, dstPrefix: GN._Prefix.tree},
          {srcPrefix: GN._Prefix.treeEntry, dstPrefix: GN._Prefix.commit},
        ],
      },
    };

    for (const edge of this._graph.edges({
      addressPrefix: GE._Prefix.base,
      srcPrefix: NodeAddress.empty,
      dstPrefix: NodeAddress.empty,
    })) {
      const address = GE.fromRaw(
        (((edge.address: EdgeAddressT): any): GE.RawAddress)
      );
      const invariant: EdgeInvariant = edgeInvariants[address.type];
      if (invariant == null) {
        throw new Error(
          `Missing invariant definition for: ${String(address.type)}`
        );
      }
      if (
        !invariant.homs.some(
          ({srcPrefix, dstPrefix}) =>
            NodeAddress.hasPrefix(edge.src, srcPrefix) &&
            NodeAddress.hasPrefix(edge.dst, dstPrefix)
        )
      ) {
        throw new Error(`invariant violation: bad hom: ${edgeToString(edge)}`);
      }
    }

    // Any HAS_TREE edge to a commit must be properly named. This
    // implies that a commit has at most one such edge. (Normal commits
    // should have trees, but submodule commits might not.)
    for (const rawNode of this._graph.nodes({prefix: GN._Prefix.commit})) {
      for (const neighbor of this._graph.neighbors(rawNode, {
        direction: Direction.OUT,
        nodePrefix: NodeAddress.empty,
        edgePrefix: GE._Prefix.hasTree,
      })) {
        const rawEdge = neighbor.edge;
        const edge: GE.HasTreeAddress = (GE.fromRaw(
          (((rawEdge.address: EdgeAddressT): any): GE.RawAddress)
        ): any);
        const node: GN.CommitAddress = ((GN.fromRaw(
          (((rawNode: NodeAddressT): any): GN.RawAddress)
        ): GN.StructuredAddress): any);
        if (node.hash !== edge.commit.hash) {
          throw new Error(
            `invariant violation: bad HAS_TREE edge: ${edgeToString(rawEdge)}`
          );
        }
      }
    }

    // All HAS_PARENT edges must map between between the correct commits.
    for (const edge of this._graph.edges({
      addressPrefix: GE._Prefix.hasParent,
      srcPrefix: NodeAddress.empty,
      dstPrefix: NodeAddress.empty,
    })) {
      const src: GN.CommitAddress = ((GN.fromRaw(
        (((edge.src: NodeAddressT): any): GN.RawAddress)
      ): GN.StructuredAddress): any);
      const dst: GN.CommitAddress = ((GN.fromRaw(
        (((edge.dst: NodeAddressT): any): GN.RawAddress)
      ): GN.StructuredAddress): any);
      const expectedEdge = GE.createEdge.hasParent(src, dst);
      if (edge.address !== expectedEdge.address) {
        throw new Error(
          `invariant violation: bad HAS_PARENT edge: ${edgeToString(edge)}`
        );
      }
    }

    // Each tree entry must have a unique and properly named INCLUDES edge.
    for (const rawNode of this._graph.nodes({prefix: GN._Prefix.treeEntry})) {
      const treeNeighbors = Array.from(
        this._graph.neighbors(rawNode, {
          direction: Direction.IN,
          nodePrefix: NodeAddress.empty,
          edgePrefix: GE._Prefix.includes,
        })
      );
      if (treeNeighbors.length !== 1) {
        throw new Error(
          "invariant violation: tree entry should have 1 inclusion, " +
            `but has ${treeNeighbors.length}: ${NodeAddress.toString(rawNode)}`
        );
      }
      const edge = treeNeighbors[0].edge;
      const tree: GN.TreeAddress = ((GN.fromRaw(
        (((edge.src: NodeAddressT): any): GN.RawAddress)
      ): GN.StructuredAddress): any);
      const treeEntry: GN.TreeEntryAddress = ((GN.fromRaw(
        (((edge.dst: NodeAddressT): any): GN.RawAddress)
      ): GN.StructuredAddress): any);
      const expectedEdge = GE.createEdge.includes(tree, treeEntry);
      if (edge.address !== expectedEdge.address) {
        throw new Error(
          `invariant violation: bad INCLUDES edge: ${edgeToString(edge)}`
        );
      }
    }

    // All BECOMES edges must map between between the correct tree entries.
    for (const edge of this._graph.edges({
      addressPrefix: GE._Prefix.becomes,
      srcPrefix: NodeAddress.empty,
      dstPrefix: NodeAddress.empty,
    })) {
      const src: GN.TreeEntryAddress = ((GN.fromRaw(
        (((edge.src: NodeAddressT): any): GN.RawAddress)
      ): GN.StructuredAddress): any);
      const dst: GN.TreeEntryAddress = ((GN.fromRaw(
        (((edge.dst: NodeAddressT): any): GN.RawAddress)
      ): GN.StructuredAddress): any);
      const expectedEdge = GE.createEdge.becomes(src, dst);
      if (edge.address !== expectedEdge.address) {
        throw new Error(
          `invariant violation: bad BECOMES edge: ${edgeToString(edge)}`
        );
      }
    }

    // All HAS_CONTENTS edges must be properly named.
    for (const edge of this._graph.edges({
      addressPrefix: GE._Prefix.hasContents,
      srcPrefix: NodeAddress.empty,
      dstPrefix: NodeAddress.empty,
    })) {
      const src: GN.TreeEntryAddress = ((GN.fromRaw(
        (((edge.src: NodeAddressT): any): GN.RawAddress)
      ): GN.StructuredAddress): any);
      const dst: GN.TreeEntryContentsAddress = ((GN.fromRaw(
        (((edge.dst: NodeAddressT): any): GN.RawAddress)
      ): GN.StructuredAddress): any);
      const expectedEdge = GE.createEdge.hasContents(src, dst);
      if (edge.address !== expectedEdge.address) {
        throw new Error(
          `invariant violation: bad HAS_CONTENTS edge: ${edgeToString(edge)}`
        );
      }
    }
  }
}
