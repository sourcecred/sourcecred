// @flow

/*
 * This module contains "Porcelain" for working with Git graphs. By
 * "Porcelain", we mean it is a much more convenient and polished API. It
 * allows accessing Git graph data via a familiar object-oriented API,
 * rather than needing to use the specific graph-based methods in the
 * underlying graph.
 *
 * In general, the porcelain module provides wrapper objects that contain the
 * entire Git graph, and a pointer to a particular entity in that graph.
 * Creating the wrappers is extremely cheap; all actual computation (e.g.
 * finding the body or author of a post) is done lazily when that information
 * is requested.
 *
 * The porcelain system is under active development.
 * I expect that we will soon refactor the base porcelain abstraction out of
 * this module into core/, and the implementation may shift to be more conserved
 * with the GitHub porcelain. The APIs should remain unchanged.
 * */
import stringify from "json-stable-stringify";

import {Graph} from "../../core/graph";
import {NodeReference, NodePorcelain} from "../../core/porcelain";
import type {Edge} from "../../core/graph";
import type {Address} from "../../core/address";

import type {
  TreeEntryNodePayload,
  SubmoduleCommitPayload,
  BlobNodePayload,
  TreeNodePayload,
  CommitNodePayload,
  IncludesEdgePayload,
  NodePayload,
  NodeType,
  Hash,
} from "./types";
import {
  BECOMES_EDGE_TYPE,
  BLOB_NODE_TYPE,
  COMMIT_NODE_TYPE,
  GIT_PLUGIN_NAME,
  HAS_CONTENTS_EDGE_TYPE,
  HAS_PARENT_EDGE_TYPE,
  HAS_TREE_EDGE_TYPE,
  INCLUDES_EDGE_TYPE,
  SUBMODULE_COMMIT_NODE_TYPE,
  TREE_ENTRY_NODE_TYPE,
  TREE_NODE_TYPE,
} from "./types";
import {commitAddress} from "./address";

function assertAddressType(address: Address, t: NodeType) {
  if (address.type !== t) {
    throw new Error(
      `Expected entity at ${stringify(address)} to have type ${t}`
    );
  }
}

export class GraphPorcelain {
  graph: Graph;
  constructor(graph: Graph) {
    this.graph = graph;
  }

  commitByHash(h: Hash): CommitReference {
    const addr = commitAddress(h);
    const nodeReference = new NodeReference(this.graph, addr);
    return new CommitReference(nodeReference);
  }
}

export class GitReference<+T: NodePayload> extends NodeReference<T> {
  constructor(ref: NodeReference<any>) {
    const addr = ref.address();
    if (addr.pluginName !== GIT_PLUGIN_NAME) {
      throw new Error(`Wrong plugin name ${addr.pluginName} for Git plugin!`);
    }
    super(ref.graph(), addr);
  }

  type(): NodeType {
    return ((super.type(): string): any);
  }

  get(): ?GitPorcelain<T> {
    const nodePorcelain = super.get();
    if (nodePorcelain != null) {
      return new GitPorcelain(nodePorcelain);
    }
  }
}

export class GitPorcelain<+T: NodePayload> extends NodePorcelain<T> {
  constructor(nodePorcelain: NodePorcelain<any>) {
    if (nodePorcelain.ref().address().pluginName !== GIT_PLUGIN_NAME) {
      throw new Error(
        `Wrong plugin name ${
          nodePorcelain.ref().address().pluginName
        } for Git plugin!`
      );
    }
    super(nodePorcelain.ref(), nodePorcelain.node());
  }
}

export class CommitReference extends GitReference<CommitNodePayload> {
  constructor(ref: NodeReference<any>) {
    super(ref);
    assertAddressType(ref.address(), COMMIT_NODE_TYPE);
  }

  hash(): Hash {
    return this.address().id;
  }

  parents(): CommitReference[] {
    return this.neighbors({
      nodeType: COMMIT_NODE_TYPE,
      edgeType: HAS_PARENT_EDGE_TYPE,
      direction: "OUT",
    }).map(({ref}) => new CommitReference(ref));
  }

  tree(): TreeReference {
    const trees = this.neighbors({
      nodeType: TREE_NODE_TYPE,
      edgeType: HAS_TREE_EDGE_TYPE,
      direction: "OUT",
    }).map(({ref}) => new TreeReference(ref));
    if (trees.length !== 1) {
      throw new Error(
        `Commit ${stringify(this.address())} has wrong number of trees`
      );
    }
    return trees[0];
  }

  get(): ?CommitPorcelain {
    const x = super.get();
    if (x != null) {
      return new CommitPorcelain(x);
    }
  }
}

export class CommitPorcelain extends GitPorcelain<CommitNodePayload> {
  constructor(nodePorcelain: NodePorcelain<any>) {
    assertAddressType(nodePorcelain.ref().address(), COMMIT_NODE_TYPE);
    super(nodePorcelain);
  }
  ref(): CommitReference {
    return new CommitReference(super.ref());
  }
}

export class TreeReference extends GitReference<TreeNodePayload> {
  constructor(ref: NodeReference<any>) {
    super(ref);
    assertAddressType(ref.address(), TREE_NODE_TYPE);
  }

  hash(): Hash {
    return this.address().id;
  }

  entries(): TreeEntryReference[] {
    return this.neighbors({
      nodeType: TREE_ENTRY_NODE_TYPE,
      edgeType: INCLUDES_EDGE_TYPE,
      direction: "OUT",
    }).map(({ref}) => new TreeEntryReference(ref));
  }

  entry(name: string): ?TreeEntryReference {
    return this.neighbors({
      nodeType: TREE_ENTRY_NODE_TYPE,
      edgeType: INCLUDES_EDGE_TYPE,
      direction: "OUT",
    })
      .filter(
        ({edge}) => (edge: Edge<IncludesEdgePayload>).payload.name === name
      )
      .map(({ref}) => new TreeEntryReference(ref))[0];
  }

  get(): ?TreePorcelain {
    const x = super.get();
    if (x != null) {
      return new TreePorcelain(x);
    }
  }
}

export class TreePorcelain extends GitPorcelain<TreeNodePayload> {
  constructor(nodePorcelain: NodePorcelain<any>) {
    assertAddressType(nodePorcelain.ref().address(), TREE_NODE_TYPE);
    super(nodePorcelain);
  }
  ref(): TreeReference {
    return new TreeReference(super.ref());
  }
}

export class TreeEntryReference extends GitReference<TreeEntryNodePayload> {
  constructor(ref: NodeReference<any>) {
    super(ref);
    assertAddressType(ref.address(), TREE_ENTRY_NODE_TYPE);
  }

  name(): string {
    const includesEdges = this.neighbors({
      nodeType: TREE_NODE_TYPE,
      edgeType: INCLUDES_EDGE_TYPE,
      direction: "IN",
    }).map(({edge}) => edge);
    if (includesEdges.length !== 1) {
      throw new Error(
        `Malformed tree structure at ${stringify(this.address())}`
      );
    }
    return (includesEdges[0]: Edge<IncludesEdgePayload>).payload.name;
  }

  evolvesTo(): TreeEntryReference[] {
    return this.neighbors({
      nodeType: TREE_ENTRY_NODE_TYPE,
      edgeType: BECOMES_EDGE_TYPE,
      direction: "OUT",
    }).map(({ref}) => new TreeEntryReference(ref));
  }

  evolvesFrom(): TreeEntryReference[] {
    return this.neighbors({
      nodeType: TREE_ENTRY_NODE_TYPE,
      edgeType: BECOMES_EDGE_TYPE,
      direction: "IN",
    }).map(({ref}) => new TreeEntryReference(ref));
  }

  blob(): ?BlobReference {
    return this.neighbors({
      edgeType: HAS_CONTENTS_EDGE_TYPE,
      nodeType: BLOB_NODE_TYPE,
      direction: "OUT",
    }).map(({ref}) => new BlobReference(ref))[0];
  }

  tree(): ?TreeReference {
    return this.neighbors({
      edgeType: HAS_CONTENTS_EDGE_TYPE,
      nodeType: TREE_NODE_TYPE,
      direction: "OUT",
    }).map(({ref}) => new TreeReference(ref))[0];
  }

  submoduleCommits(): SubmoduleCommitReference[] {
    return this.neighbors({
      edgeType: HAS_CONTENTS_EDGE_TYPE,
      nodeType: SUBMODULE_COMMIT_NODE_TYPE,
      direction: "OUT",
    }).map(({ref}) => new SubmoduleCommitReference(ref));
  }

  get(): ?TreeEntryPorcelain {
    const x = super.get();
    if (x != null) {
      return new TreeEntryPorcelain(x);
    }
  }
}

export class TreeEntryPorcelain extends GitPorcelain<TreeEntryNodePayload> {
  constructor(nodePorcelain: NodePorcelain<any>) {
    assertAddressType(nodePorcelain.ref().address(), TREE_ENTRY_NODE_TYPE);
    super(nodePorcelain);
  }
  ref(): TreeEntryReference {
    return new TreeEntryReference(super.ref());
  }
}

export class BlobReference extends GitReference<BlobNodePayload> {
  constructor(ref: NodeReference<any>) {
    super(ref);
    assertAddressType(ref.address(), BLOB_NODE_TYPE);
  }

  hash(): Hash {
    return this.address().id;
  }

  get(): ?BlobPorcelain {
    const x = super.get();
    if (x != null) {
      return new BlobPorcelain(x);
    }
  }
}

export class BlobPorcelain extends GitPorcelain<BlobNodePayload> {
  constructor(nodePorcelain: NodePorcelain<any>) {
    assertAddressType(nodePorcelain.ref().address(), BLOB_NODE_TYPE);
    super(nodePorcelain);
  }
  ref(): BlobReference {
    return new BlobReference(super.ref());
  }
}

export class SubmoduleCommitReference extends GitReference<
  SubmoduleCommitPayload
> {
  constructor(ref: NodeReference<any>) {
    super(ref);
    assertAddressType(ref.address(), SUBMODULE_COMMIT_NODE_TYPE);
  }

  get(): ?SubmoduleCommitPorcelain {
    const x = super.get();
    if (x != null) {
      return new SubmoduleCommitPorcelain(x);
    }
  }
}

export class SubmoduleCommitPorcelain extends GitPorcelain<
  SubmoduleCommitPayload
> {
  constructor(nodePorcelain: NodePorcelain<any>) {
    assertAddressType(
      nodePorcelain.ref().address(),
      SUBMODULE_COMMIT_NODE_TYPE
    );
    super(nodePorcelain);
  }

  url(): string {
    return this.payload().url;
  }

  hash(): Hash {
    return this.payload().hash;
  }
  ref(): SubmoduleCommitReference {
    return new SubmoduleCommitReference(super.ref());
  }
}
