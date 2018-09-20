// @flow

import * as N from "./nodes";
import type {Repository} from "./types";

export function description(
  address: N.StructuredAddress,
  repository: Repository
) {
  switch (address.type) {
    case "COMMIT": {
      const hash = address.hash;
      const commit = repository.commits[hash];
      if (commit == null) {
        console.error(`Unable to find data for commit ${hash}`);
        return hash;
      }
      const {shortHash, summary} = commit;
      return `${shortHash}: ${summary}`;
    }
    default:
      throw new Error(`unknown type: ${(address.type: empty)}`);
  }
}
