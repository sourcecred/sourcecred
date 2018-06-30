// @flow

import * as N from "./nodes";

export function description(address: N.StructuredAddress) {
  switch (address.type) {
    case "COMMIT":
      return `commit ${address.hash}`;
    case "TREE":
      return `tree ${address.hash}`;
    case "BLOB":
      return `blob ${address.hash}`;
    case "TREE_ENTRY":
      return `entry ${JSON.stringify(address.name)} in tree ${
        address.treeHash
      }`;
    default:
      throw new Error(`unknown type: ${(address.type: empty)}`);
  }
}
