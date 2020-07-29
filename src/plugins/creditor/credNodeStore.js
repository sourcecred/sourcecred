// @flow

import {type CreditorNode, type NodeUuid, type NodeTagId} from "./creditorNode";
import {JsonLog} from "../../util/jsonLog";

export type NodeEntry = {|type: "NODE", entry: CreditorNode|};
export type NodeDetails = {title: string, id: NodeUuid};
type NodesFile = JsonLog<NodeEntry>;

export function toNodeEntry(entry: CreditorNode): NodeEntry {
  return {type: "NODE", entry};
}

export function fromNodeEntry({entry}: NodeEntry): [NodeUuid, CreditorNode] {
  return [entry.id, entry];
}

export function getDetails({id, title}: CreditorNode): NodeDetails {
  return {id, title};
}

/**
 * CredNodeStore is the static, in-memory representation of creditor nodes
 *
 * This class is used to accept and validate frontend inputs, and export them in
 * serialized format utilizing the jsonLog functionality when saving to a file.
 * Nodes in this class are still modifiable, of course, and jsonLogging is utilized
 * because it outputs a gitdiff-friendly format
 *
 * Nodes in the the cred node store are not deletable at this time. In lieu of deleting nodes,
 * their weights (`mint` values) can simply be set to zero
 */
export default class CredNodeStore {
  +_nodes: Map<NodeUuid, CreditorNode>;

  constructor(fromDisk: NodesFile | void) {
    if (!fromDisk) {
      this._nodes = new Map();
    } else {
      const nodeKVArray = Array.from(fromDisk.values()).map(fromNodeEntry);
      this._nodes = new Map(nodeKVArray);
    }
  }

  serialize(): string {
    const log = new JsonLog();
    const sortedEntries = Array.from(this.values()).sort(
      ({createdAt: a}, {createdAt: b}) => a - b
    );
    return log.append(sortedEntries.map(toNodeEntry)).toString();
  }

  set(node: CreditorNode): CredNodeStore {
    const {
      id,
      tags,
      title,
      description,
      graphTimestamp,
      createdAt,
      parent,
    } = node;
    if (!id) {
      throw new Error("Creditor Node UUID required");
    }
    if (!Array.isArray(tags)) throw new Error("`tags` must be an array");
    if (!(title || description))
      throw new Error("`title` and `description` are required in Cred Nodes");
    if (!(graphTimestamp || createdAt))
      throw new Error(
        "`createdAt` and `graphTimestamp` values must be non-zero"
      );
    if (parent && !this._nodes.has(parent))
      throw new Error("cannot add node with nonexistent parent");
    this._nodes.set(node.id, node);
    return this;
  }

  get(id: NodeUuid): ?CreditorNode {
    return this._nodes.get(id);
  }

  values(): Iterator<CreditorNode> {
    return this._nodes.values();
  }

  referencingTag(id: NodeTagId): NodeDetails[] {
    return Array.from(this._nodes.values())
      .filter(({tags}) => tags.includes(id))
      .map(getDetails);
  }

  getParent(child: NodeUuid): ?CreditorNode {
    const childNode = this._nodes.get(child);
    if (!childNode)
      throw new Error(`cred node with Id ${child} does not exist`);
    if (!childNode.parent) return null;
    return this._nodes.get(childNode.parent);
  }
}
