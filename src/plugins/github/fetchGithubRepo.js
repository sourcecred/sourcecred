// @flow
/*
 * API to scrape data from a GitHub repo using the GitHub API. See the
 * docstring of the default export for more details.
 */

import fetch from "isomorphic-fetch";
import retry from "retry";

import {stringify, inlineLayout} from "../../graphql/queries";
import {createQuery, createVariables, postQueryExhaustive} from "./graphql";
import type {GithubResponseJSON} from "./graphql";
import type {RepoId} from "../../core/repoId";

/**
 * Scrape data from a GitHub repo using the GitHub API.
 *
 * @param {RepoId} repoId
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
  repoId: RepoId,
  token: string
): Promise<GithubResponseJSON> {
  token = String(token);

  const validToken = /^[A-Fa-f0-9]{40}$/;
  if (!validToken.test(token)) {
    throw new Error(`Invalid token: ${token}`);
  }

  const body = createQuery();
  const variables = createVariables(repoId);
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

type GithubResponseError =
  | {|+type: "FETCH_ERROR", retry: false, error: Error|}
  | {|+type: "GRAPHQL_ERROR", retry: false, error: mixed|}
  | {|+type: "RATE_LIMIT_EXCEEDED", retry: false, error: mixed|}
  | {|+type: "GITHUB_INTERNAL_EXECUTION_ERROR", retry: true, error: mixed|}
  | {|+type: "NO_DATA", retry: true, error: mixed|};

// Fetch against the GitHub API with the provided options, returning a
// promise that either resolves to the GraphQL result data or rejects
// to a `GithubResponseError`.
function tryGithubFetch(fetch, fetchOptions): Promise<any> {
  return fetch(GITHUB_GRAPHQL_SERVER, fetchOptions).then(
    (x) =>
      x.json().then((x) => {
        if (x.errors) {
          if (
            x.errors.length === 1 &&
            x.errors[0].message.includes("it could be a GitHub bug")
          ) {
            return Promise.reject(
              ({
                type: "GITHUB_INTERNAL_EXECUTION_ERROR",
                retry: true,
                error: x,
              }: GithubResponseError)
            );
          } else if (
            x.errors.length === 1 &&
            x.errors[0].type === "RATE_LIMITED"
          ) {
            return Promise.reject(
              ({
                type: "RATE_LIMIT_EXCEEDED",
                retry: false,
                error: x,
              }: GithubResponseError)
            );
          } else {
            return Promise.reject(
              ({
                type: "GRAPHQL_ERROR",
                retry: false,
                error: x,
              }: GithubResponseError)
            );
          }
        }
        if (x.data === undefined) {
          // See https://github.com/sourcecred/sourcecred/issues/350.
          return Promise.reject(
            ({type: "NO_DATA", retry: true, error: x}: GithubResponseError)
          );
        }
        return Promise.resolve(x.data);
      }),
    (e) =>
      Promise.reject(
        ({type: "FETCH_ERROR", retry: false, error: e}: GithubResponseError)
      )
  );
}

function retryGithubFetch(fetch, fetchOptions) {
  return new Promise((resolve, reject) => {
    const operation = retry.operation();
    operation.attempt(() => {
      tryGithubFetch(fetch, fetchOptions)
        .then((result) => {
          resolve(result);
        })
        .catch((error) => {
          if (error.retry && operation.retry(true)) {
            return;
          } else {
            reject(error);
          }
        });
    });
  });
}

async function postQuery({body, variables}, token): Promise<any> {
  const postBody = JSON.stringify({
    query: stringify.body(body, inlineLayout()),
    variables: variables,
  });
  const fetchOptions = {
    method: "POST",
    body: postBody,
    headers: {
      Authorization: `bearer ${token}`,
    },
  };
  return retryGithubFetch(fetch, fetchOptions).catch(
    (error: GithubResponseError) => {
      const type = error.type;
      switch (type) {
        case "GITHUB_INTERNAL_EXECUTION_ERROR":
        case "NO_DATA":
          console.error(
            "GitHub query failed! We're tracking these issues at " +
              "https://github.com/sourcecred/sourcecred/issues/350.\n" +
              "If the error is a timeout or abuse rate limit, you can " +
              "try loading a smaller repo, or trying again in a few minutes.\n" +
              "The actual failed response can be found below:\n" +
              "================================================="
          );
          console.error(error.error);
          break;
        case "GRAPHQL_ERROR":
          console.error(
            "Unexpected GraphQL error; this may be a bug in SourceCred: ",
            JSON.stringify({postBody: postBody, error: error.error})
          );
          break;
        case "RATE_LIMIT_EXCEEDED":
          console.error(
            "You've exceeded your hourly GitHub rate limit.\n" +
              "You'll need to wait until it resets."
          );
          break;
        case "FETCH_ERROR":
          // Network error; no need for additional commentary.
          break;
        default:
          throw new Error((type: empty));
      }
      return Promise.reject(error);
    }
  );
}

function ensureNoMorePages(result: any, path = []) {
  if (result == null) {
    return;
  }
  if (result.pageInfo) {
    if (result.pageInfo.hasNextPage) {
      console.error(result);
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
