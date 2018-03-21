// @flow
/*
 * API to scrape data from a GitHub repo using the GitHub API. See the
 * docstring of the default export for more details.
 */

import fetch from "isomorphic-fetch";

import type {Body} from "../../graphql/queries";
import * as GraphQLQueries from "../../graphql/queries";

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

  const query = GraphQLQueries.stringify.body(
    createQuery(),
    GraphQLQueries.inlineLayout()
  );
  const variables = {repoOwner, repoName};
  const payload = {query, variables};
  return postQuery(payload, token);
}

const GITHUB_GRAPHQL_SERVER = "https://api.github.com/graphql";

function createQuery(): Body {
  const b = GraphQLQueries.build;
  const makePageInfo = () => b.field("pageInfo", {}, [b.field("hasNextPage")]);
  const makeAuthor = () => b.field("author", {}, [b.fragmentSpread("whoami")]);
  const body: Body = [
    b.query(
      "FetchData",
      [b.param("repoOwner", "String!"), b.param("repoName", "String!")],
      [
        b.field(
          "repository",
          {owner: b.variable("repoOwner"), name: b.variable("repoName")},
          [
            b.field("issues", {first: b.literal(100)}, [
              makePageInfo(),
              b.field("nodes", {}, [
                b.field("id"),
                b.field("title"),
                b.field("body"),
                b.field("number"),
                makeAuthor(),
                b.field("comments", {first: b.literal(20)}, [
                  makePageInfo(),
                  b.field("nodes", {}, [
                    b.field("id"),
                    makeAuthor(),
                    b.field("body"),
                    b.field("url"),
                  ]),
                ]),
              ]),
            ]),
            b.field("pullRequests", {first: b.literal(100)}, [
              makePageInfo(),
              b.field("nodes", {}, [
                b.field("id"),
                b.field("title"),
                b.field("body"),
                b.field("number"),
                makeAuthor(),
                b.field("comments", {first: b.literal(20)}, [
                  makePageInfo(),
                  b.field("nodes", {}, [
                    b.field("id"),
                    makeAuthor(),
                    b.field("body"),
                    b.field("url"),
                  ]),
                ]),
                b.field("reviews", {first: b.literal(10)}, [
                  makePageInfo(),
                  b.field("nodes", {}, [
                    b.field("id"),
                    b.field("body"),
                    makeAuthor(),
                    b.field("state"),
                    b.field("comments", {first: b.literal(10)}, [
                      makePageInfo(),
                      b.field("nodes", {}, [
                        b.field("id"),
                        b.field("body"),
                        b.field("url"),
                        makeAuthor(),
                      ]),
                    ]),
                  ]),
                ]),
              ]),
            ]),
          ]
        ),
      ]
    ),
    b.fragment("whoami", "Actor", [
      b.field("__typename"),
      b.field("login"),
      b.inlineFragment("User", [b.field("id")]),
      b.inlineFragment("Organization", [b.field("id")]),
      b.inlineFragment("Bot", [b.field("id")]),
    ]),
  ];
  return body;
}

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
