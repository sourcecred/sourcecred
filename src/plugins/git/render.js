// @flow

import React, {type Element as ReactElement} from "react";
import Link from "../../webutil/Link";
import * as N from "./nodes";
import type {Repository} from "./types";
import {type RepoIdString, stringToRepoId} from "../github/repoId";
import type {GitGateway} from "./gitGateway";

export function description(
  address: N.StructuredAddress,
  repository: Repository,
  gateway: GitGateway
): ReactElement<"code"> | ReactElement<"span"> {
  switch (address.type) {
    case "COMMIT": {
      const hash = address.hash;
      const commit = repository.commits[hash];
      if (commit == null) {
        return <code>{hash}</code>;
      }
      // This `any`-cast courtesy of facebook/flow#6927.
      const repoIdStrings: $ReadOnlyArray<RepoIdString> = (Object.keys(
        repository.commitToRepoId[hash] || {}
      ): any);
      if (repoIdStrings.length === 0) {
        console.error(`Unable to find repoIds for commit ${hash}`);
        // TODO(@wchargin): This shortHash is unambiguous for a single repo,
        // but might be ambiguous across many repositories. Consider disambiguating
        return (
          <span>
            <code>{commit.shortHash}</code>: {commit.summary}
          </span>
        );
      }
      const repoId = stringToRepoId(repoIdStrings[0]);
      const url = gateway.commitUrl(repoId, commit.hash);
      const hyperlinkedHash = hyperlink(url, commit.shortHash);
      return (
        <span>
          <code>{hyperlinkedHash}</code>: {commit.summary}
        </span>
      );
    }
    default:
      throw new Error(`unknown type: ${(address.type: empty)}`);
  }
}

function hyperlink(url, text) {
  return (
    <Link href={url} target="_blank" rel="nofollow noopener">
      {text}
    </Link>
  );
}
