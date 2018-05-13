// @flow

import type {Address} from "core/address";
import type {Graph} from "core/graph";
import type {NodeType, SubmoduleCommitPayload} from "./types";

/**
 * Describe a node provided by the Git plugin.
 */
export function nodeDescription(graph: Graph<any, any>, address: Address) {
  const type: NodeType = (address.type: any);
  switch (type) {
    case "COMMIT":
      return `commit ${address.id}`;
    case "TREE":
      return `tree ${address.id}`;
    case "BLOB":
      return `blob ${address.id}`;
    case "SUBMODULE_COMMIT": {
      const payload: SubmoduleCommitPayload = graph.node(address).payload;
      return `submodule commit ${payload.hash} in ${payload.url}`;
    }
    case "TREE_ENTRY":
      return `entry ${address.id}`;
    default:
      // eslint-disable-next-line no-unused-expressions
      (type: empty);
      throw new Error(`unknown type: ${type}`);
  }
}
