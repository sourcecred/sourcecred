// @flow
/*
 * API to scrape data from a GitHub repo using the GitHub API. See the
 * docstring of the default export for more details.
 */

import fetch from "isomorphic-fetch";

import {stringify, inlineLayout} from "../../graphql/queries";
import {createQuery, createVariables, postQueryExhaustive} from "./graphql";
import type {GithubResponseJSON} from "./graphql";

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
export default function fetchGithubRepo(
  repoOwner: string,
  repoName: string,
  token: string
): Promise<GithubResponseJSON> {
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

  const body = createQuery();
  const variables = createVariables(repoOwner, repoName);
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
      if (x.errors) {
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
