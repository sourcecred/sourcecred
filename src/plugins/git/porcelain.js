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
import type {Node} from "../../core/graph";
import type {Address} from "../../core/address";

import type {
  TreeEntryNodePayload,
  SubmoduleCommitPayload,
  BlobNodePayload,
  TreeNodePayload,
  CommitNodePayload,
  NodePayload,
  NodeType,
  Hash,
} from "./types";
import {GIT_PLUGIN_NAME} from "./types";
import {commitAddress} from "./address";

export class PorcelainGraph {
  graph: Graph<any, any>;
  constructor(graph: Graph<any, any>) {
    this.graph = graph;
  }

  // Note that this method is presently unsafe, as the hash may not exist.
  // In the future, we will come up with a general case solution to have
  // the type system verify that returned porcelains must be existence-tested
  // before their properties are usable.
  commitByHash(h: Hash): Commit {
    const addr = commitAddress(h);
    return new Commit(this.graph, addr);
  }
}

export type GitPorcelain = Commit | Blob | Tree | TreeEntry | SubmoduleCommit;

class BaseGitPorcelain<T: NodePayload> {
  graph: Graph<any, any>;
  nodeAddress: Address;

  constructor(graph: Graph<any, any>, nodeAddress: Address) {
    if (nodeAddress.pluginName !== GIT_PLUGIN_NAME) {
      throw new Error(
        `Tried to create Git porcelain for node from plugin: ${
          nodeAddress.pluginName
        }`
      );
    }
    this.graph = graph;
    this.nodeAddress = nodeAddress;
  }

  type(): NodeType {
    return (this.address().type: any);
  }

  node(): Node<T> {
    return this.graph.node(this.nodeAddress);
  }

  address(): Address {
    return this.nodeAddress;
  }
}

export class Commit extends BaseGitPorcelain<CommitNodePayload> {
  static from(n: BaseGitPorcelain<any>): Commit {
    if (n.type() !== "COMMIT") {
      throw new Error(`Unable to cast ${n.type()} to Commit`);
    }
    return new Commit(n.graph, n.nodeAddress);
  }

  hash(): Hash {
    return this.address().id;
  }

  parents(): Commit[] {
    return this.graph
      .neighborhood(this.nodeAddress, {
        nodeType: "COMMIT",
        edgeType: "HAS_PARENT",
        direction: "OUT",
      })
      .map(({neighbor}) => new Commit(this.graph, neighbor));
  }

  tree(): Tree {
    const trees = this.graph
      .neighborhood(this.nodeAddress, {
        nodeType: "TREE",
        edgeType: "HAS_TREE",
        direction: "OUT",
      })
      .map(({neighbor}) => new Tree(this.graph, neighbor));
    if (trees.length !== 1) {
      throw new Error(
        `Commit ${stringify(this.nodeAddress)} has wrong number of trees`
      );
    }
    return trees[0];
  }
}

export class Tree extends BaseGitPorcelain<TreeNodePayload> {
  static from(n: BaseGitPorcelain<any>): Tree {
    if (n.type() !== "TREE") {
      throw new Error(`Unable to cast ${n.type()} to Tree`);
    }
    return new Tree(n.graph, n.nodeAddress);
  }

  hash(): Hash {
    return this.address().id;
  }

  entries(): TreeEntry[] {
    return this.graph
      .neighborhood(this.nodeAddress, {
        nodeType: "TREE_ENTRY",
        edgeType: "INCLUDES",
        direction: "OUT",
      })
      .map(({neighbor}) => new TreeEntry(this.graph, neighbor));
  }

  entry(name: string): ?TreeEntry {
    return this.entries().filter((te) => te.name() === name)[0];
  }
}

export class TreeEntry extends BaseGitPorcelain<TreeEntryNodePayload> {
  static from(n: BaseGitPorcelain<any>): TreeEntry {
    if (n.type() !== "TREE_ENTRY") {
      throw new Error(`Unable to cast ${n.type()} to TreeEntry`);
    }
    return new TreeEntry(n.graph, n.nodeAddress);
  }

  name(): string {
    return this.node().payload.name;
  }

  evolvesTo(): TreeEntry[] {
    return this.graph
      .neighborhood(this.nodeAddress, {
        nodeType: "TREE_ENTRY",
        edgeType: "BECOMES",
        direction: "OUT",
      })
      .map(({neighbor}) => new TreeEntry(this.graph, neighbor));
  }

  evolvesFrom(): TreeEntry[] {
    return this.graph
      .neighborhood(this.nodeAddress, {
        nodeType: "TREE_ENTRY",
        edgeType: "BECOMES",
        direction: "IN",
      })
      .map(({neighbor}) => new TreeEntry(this.graph, neighbor));
  }

  /*
   * May be a single Tree, single Blob, or zero or more
   * SubmoduleCommits. The Tree or Blob are put in an array for
   * consistency.
   *
   */
  contents(): Tree[] | Blob[] | SubmoduleCommit[] {
    // Note: the function has the correct type signature,
    // but as-implemented it should be a flow error.
    // When flow fixes this, maintain the current method signature.
    return this.graph
      .neighborhood(this.nodeAddress, {
        edgeType: "HAS_CONTENTS",
        direction: "OUT",
      })
      .map(({neighbor}) => {
        switch (neighbor.type) {
          case "BLOB":
            return new Blob(this.graph, neighbor);
          case "TREE":
            return new Tree(this.graph, neighbor);
          case "SUBMODULE_COMMIT":
            return new SubmoduleCommit(this.graph, neighbor);
          default:
            throw new Error(`Neighbor had invalid type ${neighbor.type}`);
        }
      });
  }
}

export class Blob extends BaseGitPorcelain<BlobNodePayload> {
  static from(n: BaseGitPorcelain<any>): Blob {
    if (n.type() !== "BLOB") {
      throw new Error(`Unable to cast ${n.type()} to Blob`);
    }
    return new Blob(n.graph, n.nodeAddress);
  }

  hash(): Hash {
    return this.nodeAddress.id;
  }
}

export class SubmoduleCommit extends BaseGitPorcelain<SubmoduleCommitPayload> {
  static from(n: BaseGitPorcelain<any>): SubmoduleCommit {
    if (n.type() !== "SUBMODULE_COMMIT") {
      throw new Error(`Unable to cast ${n.type()} to SubmoduleCommit`);
    }
    return new SubmoduleCommit(n.graph, n.nodeAddress);
  }

  url(): string {
    return this.node().payload.url;
  }

  hash(): Hash {
    return this.node().payload.hash;
  }
}
