// @flow

import {type RepoId, makeRepoId} from "./repoId";
import * as Queries from "../../graphql/queries";
import {postQuery} from "./fetchGithubRepo";
import {type GithubToken} from "./token";

export type Organization = {|
  +repos: $ReadOnlyArray<RepoId>,
  +name: string,
|};

const DEFAULT_PAGE_SIZE = 100;

/**
 * Fetches information about a given GitHub organization.
 *
 * Currently just gets the ids of its repositories, but we may want additional
 * information in the future.
 */
export async function fetchGithubOrg(
  org: string,
  token: GithubToken,
  // Regular clients should leave pageSize at the default 50.
  // Exposed for testing purposes.
  pageSize: ?number
): Promise<Organization> {
  const numRepos = pageSize == null ? DEFAULT_PAGE_SIZE : pageSize;
  const b = Queries.build;
  const makePayload = (afterCursor: ?string) => {
    const afterArg = afterCursor == null ? {} : {after: b.literal(afterCursor)};
    const args = {
      query: b.variable("searchQuery"),
      type: b.enumLiteral("REPOSITORY"),
      first: b.literal(numRepos),
      ...afterArg,
    };
    return {
      body: [
        b.query(
          "PerformSearch",
          [b.param("searchQuery", "String!")],
          [
            b.field("search", args, [
              b.field("nodes", {}, [
                b.inlineFragment("Repository", [
                  b.field("name"),
                  b.field("id"),
                ]),
              ]),
              b.field("pageInfo", {}, [
                b.field("endCursor"),
                b.field("hasNextPage"),
              ]),
            ]),
          ]
        ),
      ],
      variables: {searchQuery: `org:${org}`},
    };
  };

  let result = await postQuery(makePayload(), token);
  const resultNodes = [result.search.nodes];
  while (result.search.pageInfo.hasNextPage) {
    const afterCursor = result.search.pageInfo.endCursor;
    result = await postQuery(makePayload(afterCursor), token);
    resultNodes.push(result.search.nodes);
  }
  const repos = [].concat(...resultNodes).map((n) => makeRepoId(org, n.name));
  return {repos, name: org};
}
