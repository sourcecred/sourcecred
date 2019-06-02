// @flow

import * as N from "./nodes";
import type {Repository} from "./types";
import {type RepoIdString, stringToRepoId} from "../../core/repoId";
import type {GitGateway} from "./gitGateway";

/**
 * Oneline markdown description as required by AnalysisAdapter.
 */
export function description(
  address: N.StructuredAddress,
  repository: Repository,
  gateway: GitGateway
) {
  switch (address.type) {
    case "COMMIT": {
      const hash = address.hash;
      const commit = repository.commits[hash];
      if (commit == null) {
        return hash;
      }
      // This `any`-cast courtesy of facebook/flow#6927.
      const repoIdStrings: $ReadOnlyArray<RepoIdString> = (Object.keys(
        repository.commitToRepoId[hash] || {}
      ): any);
      if (repoIdStrings.length === 0) {
        console.error(`Unable to find repoIds for commit ${hash}`);
        // TODO(@wchargin): This shortHash is unambiguous for a single repo,
        // but might be ambiguous across many repositories. Consider disambiguating
        return `${commit.shortHash}: ${commit.summary}`;
      }
      const repoId = stringToRepoId(repoIdStrings[0]);
      const url = gateway.commitUrl(repoId, commit.hash);
      return `[${commit.shortHash}](${url}): ${commit.summary}`;
    }
    default:
      throw new Error(`unknown type: ${(address.type: empty)}`);
  }
}
