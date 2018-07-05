// @flow

import * as N from "./nodes";
import * as E from "./edges";

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

export function edgeVerb(
  address: E.StructuredAddress,
  direction: "FORWARD" | "BACKWARD"
) {
  const forward = direction === "FORWARD";
  switch (address.type) {
    case "HAS_TREE":
      return forward ? "has tree" : "owned by";
    case "HAS_PARENT":
      return forward ? "has parent" : "is parent of";
    case "INCLUDES":
      return forward ? "includes" : "is included by";
    case "BECOMES":
      return forward ? "evolves to" : "evolves from";
    case "HAS_CONTENTS":
      return forward ? "has contents" : "is contents of";
    default:
      throw new Error(`unknown type: ${(address.type: empty)}`);
  }
}
