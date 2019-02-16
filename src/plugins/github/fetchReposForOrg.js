// @flow

import {type RepoId, makeRepoId} from "../../core/repoId";
import dedent from "../../util/dedent";

const GITHUB_GRAPHQL_SERVER = "https://api.github.com/graphql";
async function ghquery(query, token): any {
  const body = JSON.stringify({query});
  const fetchOptions = {
    method: "POST",
    body,
    headers: {
      Authorization: `bearer ${token}`,
    },
  };
  const response = await fetch(GITHUB_GRAPHQL_SERVER, fetchOptions);
  const json = await response.json();
  if (json.errors) {
    throw json.errors;
  }
  return json;
}

export async function fetchReposForOrg(
  org: string,
  token: string
): Promise<$ReadOnlyArray<RepoId>> {
  const query = dedent`\
  {
    search(query: "org:${org}", type: REPOSITORY, first: 50) {
      nodes {
        ... on Repository {
          name
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
  `;
  let json = await ghquery(query, token);
  console.log(json);
  let repos = json.data.search.nodes.map((x) => makeRepoId(org, x.name));
  while (json.data.search.pageInfo.hasNextPage) {
    const query = dedent`\
  {
    search(query: "org:${org}", type: REPOSITORY, first: 50, after: "${
      json.data.search.pageInfo.endCursor
    }") {
      nodes {
        ... on Repository {
          name
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
  `;
    json = await ghquery(query, token);
    const newRepos = json.data.search.nodes.map((x) => makeRepoId(org, x.name));
    repos = repos.concat(newRepos);
  }
  console.log(repos);
  return repos;
}
