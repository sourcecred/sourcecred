// @flow
/*
 * API to scrape data from a GitHub repo using the GitHub API. See the
 * docstring of the default export for more details.
 */

import fetch from "isomorphic-fetch";

/**
 * Scrape data from a GitHub repo using the GitHub API.
 *
 * @param {String} repoOwner
 *    the GitHub username of the owner of the repository to be scraped
 * @param {String} repoName
 *    the name of the repository to be scraped
 * @param {String} token
 *    authentication token to be used for the GitHub API; generate a
 *    token at: https://github.com/settings/tokens
 * @return {Promise<object>}
 *    a promise that resolves to a JSON object containing the data
 *    scraped from the repository, with data format to be specified
 *    later
 */
export default function fetchGitHubRepo(
  repoOwner: string,
  repoName: string,
  token: string
): Promise<Object> {
  repoOwner = String(repoOwner);
  repoName = String(repoName);
  token = String(token);

  const validName = /^[A-Za-z0-9_-]*$/;
  if (!validName.test(repoOwner)) {
    throw new Error(`Invalid repoOwner: ${repoOwner}`);
  }
  if (!validName.test(repoName)) {
    throw new Error(`Invalid repoName: ${repoName}`);
  }
  const validToken = /^[A-Fa-f0-9]{40}$/;
  if (!validToken.test(token)) {
    throw new Error(`Invalid token: ${token}`);
  }

  const query = `query FetchData($repoOwner: String!, $repoName: String!) {
    repository(owner: $repoOwner, name: $repoName) {
      issues(first: 100) {
        pageInfo {
          hasNextPage
        }
        nodes {
          id
          title
          body
          number
          author {
            ...whoami
          }
          comments(first: 20) {
            pageInfo {
              hasNextPage
            }
            nodes {
              id
              author {
                ...whoami
              }
              body
              url
            }
          }
        }
      }
      pullRequests(first: 100) {
        pageInfo {
          hasNextPage
        }
        nodes {
          id
          title
          body
          number
          author {
            ...whoami
          }
          comments(first: 20) {
            pageInfo {
              hasNextPage
            }
            nodes {
              id
              author {
                ...whoami
              }
              body
              url
            }
          }
          reviews(first: 10) {
            pageInfo {
              hasNextPage
            }
            nodes {
              id
              body
              author {
                ...whoami
              }
              state
              comments(first: 10) {
                pageInfo {
                  hasNextPage
                }
                nodes {
                  id
                  body
                  author {
                    ...whoami
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  fragment whoami on Actor {
    __typename
    login
    ... on User {
      id
    }
    ... on Organization {
      id
    }
    ... on Bot {
      id
    }
  }
  `;
  const variables = {repoOwner, repoName};
  const payload = {query, variables};
  return postQuery(payload, token);
}

const GITHUB_GRAPHQL_SERVER = "https://api.github.com/graphql";

function postQuery(payload, token) {
  return fetch(GITHUB_GRAPHQL_SERVER, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `bearer ${token}`,
    },
  })
    .then((x) => x.json())
    .then((x) => {
      if (x.errors) {
        return Promise.reject(x);
      }
      ensureNoMorePages(x);
      return Promise.resolve(x);
    });
}

function ensureNoMorePages(result, path = []) {
  if (result == null) {
    return;
  }
  if (result.pageInfo) {
    if (result.pageInfo.hasNextPage) {
      throw new Error(`More pages at: ${path.join()}`);
    }
  }
  if (Array.isArray(result)) {
    result.forEach((item, i) => {
      ensureNoMorePages(item, [...path, i]);
    });
  } else if (typeof result === "object") {
    Object.keys(result).forEach((k) => {
      ensureNoMorePages(result[k], [...path, k]);
    });
  }
}
