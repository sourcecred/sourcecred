// @flow

import {NodeReference} from "../../core/porcelain";
import {SubmoduleCommitReference, GitReference} from "./porcelain";

/**
 * Describe a node provided by the Git plugin.
 */
export function nodeDescription(nodeReference: NodeReference<any>) {
  const gReference = new GitReference(nodeReference);
  const type = gReference.type();
  const address = gReference.address();
  switch (type) {
    case "COMMIT":
      return `commit ${address.id}`;
    case "TREE":
      return `tree ${address.id}`;
    case "BLOB":
      return `blob ${address.id}`;
    case "SUBMODULE_COMMIT": {
      const scRef = new SubmoduleCommitReference(gReference);
      const scPorcelain = scRef.get();
      if (scPorcelain != null) {
        return `submodule commit ${scPorcelain.hash()} in ${scPorcelain.url()}`;
      } else {
        return `submodule commit [unknown]`;
      }
    }
    case "TREE_ENTRY":
      return `entry ${address.id}`;
    default:
      // eslint-disable-next-line no-unused-expressions
      (type: empty);
      throw new Error(`unknown type: ${type}`);
  }
}
