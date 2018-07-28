// @flow
/*
 * API to scrape data from a GitHub repo using the GitHub API. See the
 * docstring of the default export for more details.
 */

import fetch from "isomorphic-fetch";

import {stringify, inlineLayout} from "../../graphql/queries";
import {createQuery, createVariables, postQueryExhaustive} from "./graphql";
import type {GithubResponseJSON} from "./graphql";
import type {Repo} from "../../core/repo";

/**
 * Scrape data from a GitHub repo using the GitHub API.
 *
 * @param {Repo} repo
 *    the GitHub repository to be scraped
 * @param {String} token
 *    authentication token to be used for the GitHub API; generate a
 *    token at: https://github.com/settings/tokens
 * @return {Promise<object>}
 *    a promise that resolves to a JSON object containing the data
 *    scraped from the repository, with data format to be specified
 *    later
 */
export default function fetchGithubRepo(
  repo: Repo,
  token: string
): Promise<GithubResponseJSON> {
  token = String(token);

  const validToken = /^[A-Fa-f0-9]{40}$/;
  if (!validToken.test(token)) {
    throw new Error(`Invalid token: ${token}`);
  }

  const body = createQuery();
  const variables = createVariables(repo);
  const payload = {body, variables};
  return postQueryExhaustive(
    (somePayload) => postQuery(somePayload, token),
    payload
  ).then((x: GithubResponseJSON) => {
    ensureNoMorePages(x);
    return x;
  });
}

const GITHUB_GRAPHQL_SERVER = "https://api.github.com/graphql";

function postQuery({body, variables}, token) {
  const payload = {
    query: stringify.body(body, inlineLayout()),
    variables: variables,
  };
  return fetch(GITHUB_GRAPHQL_SERVER, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `bearer ${token}`,
    },
  })
    .then((x) => x.json())
    .then((x) => {
      if (x.errors || x.data === undefined) {
        console.error(
          "GitHub query failed! We're tracking these issues at " +
            "https://github.com/sourcecred/sourcecred/issues/350.\n" +
            "If the error is a timeout or abuse rate limit, you can " +
            "try loading a smaller repo, or trying again in a few minutes.\n" +
            "The actual failed response can be found below:\n" +
            "================================================="
        );
        return Promise.reject(x);
      }
      return Promise.resolve(x.data);
    });
}

function ensureNoMorePages(result: any, path = []) {
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
