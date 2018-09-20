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
    if (!NodeAddress.hasPrefix(options.nodePrefix, GN.Prefix.base)) {
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
    for (const node of this._graph.nodes({prefix: GN.Prefix.commit})) {
      const rawAddress: GN.RawAddress = ((node: NodeAddressT): any);
      const commit: GN.CommitAddress = (GN.fromRaw(rawAddress): any);
      this._maybeCheckInvariants();
      yield commit;
    }
    this._maybeCheckInvariants();
  }

  parents(commit: GN.CommitAddress): Iterator<GN.CommitAddress> {
    const result: Iterator<GN.CommitAddress> = this._neighbors(commit, {
      direction: Direction.OUT,
      nodePrefix: GN.Prefix.commit,
      edgePrefix: GE.Prefix.hasParent,
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
    for (const node of this._graph.nodes({prefix: GN.Prefix.base})) {
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
      [GE.HAS_PARENT_TYPE]: {
        prefix: GE.Prefix.hasParent,
        homs: [{srcPrefix: GN.Prefix.commit, dstPrefix: GN.Prefix.commit}],
      },
    };

    for (const edge of this._graph.edges({
      addressPrefix: GE.Prefix.base,
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

    // All HAS_PARENT edges must map between between the correct commits.
    for (const edge of this._graph.edges({
      addressPrefix: GE.Prefix.hasParent,
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
  }
}
