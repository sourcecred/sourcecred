// @flow
/*
 * API to scrape data from a GitHub repo using the GitHub API. See the
 * docstring of the default export for more details.
 */

import Database from "better-sqlite3";
import fetch from "isomorphic-fetch";

import {type RepoId, repoIdToString} from "./repoId";
import {Mirror} from "../../graphql/mirror";
import * as Queries from "../../graphql/queries";
import {stringify, inlineLayout, type Body} from "../../graphql/queries";
import * as Schema from "../../graphql/schema";
import type {Repository} from "./graphqlTypes";
import schema from "./schema";
import {type GithubToken} from "./token";
import {cacheIdForRepoId} from "./cacheId";
import {type CacheProvider} from "../../backend/cache";
import retry, {type AttemptOutcome} from "../../util/retry";

type FetchRepoOptions = {|
  +token: GithubToken,
  +cache: CacheProvider,
|};

/**
 * Retrieve previously scraped data for a GitHub repo from cache.
 *
 * Note: the GithubToken requirement is planned to be removed.
 * See https://github.com/sourcecred/sourcecred/issues/1580
 *
 * @param {RepoId} repoId
 *    the GitHub repository to retrieve from cache
 * @param {GithubToken} token
 *    authentication token to be used for the GitHub API; generate a
 *    token at: https://github.com/settings/tokens
 * @return {Promise<Repository>}
 *    a promise that resolves to a JSON object containing the data
 *    scraped from the repository, with data format to be specified
 *    later
 */
export async function fetchGithubRepoFromCache(
  repoId: RepoId,
  {token, cache}: FetchRepoOptions
): Promise<Repository> {
  // TODO: remove the need for a GithubToken to resolve the ID.
  // See https://github.com/sourcecred/sourcecred/issues/1580
  const postQueryWithToken = (payload) => postQuery(payload, token);
  const resolvedId: Schema.ObjectId = await resolveRepositoryGraphqlId(
    postQueryWithToken,
    repoId
  );

  const db = await cache.database(cacheIdForRepoId(repoId));
  const mirror = new Mirror(db, schema(), {
    guessTypename: _guessTypename,
  });

  return ((mirror.extract(resolvedId): any): Repository);
}

/**
 * Scrape data from a GitHub repo using the GitHub API.
 *
 * @param {RepoId} repoId
 *    the GitHub repository to be scraped
 * @param {GithubToken} token
 *    authentication token to be used for the GitHub API; generate a
 *    token at: https://github.com/settings/tokens
 * @return {Promise<object>}
 *    a promise that resolves to a JSON object containing the data
 *    scraped from the repository, with data format to be specified
 *    later
 */
export default async function fetchGithubRepo(
  repoId: RepoId,
  {token, cache}: FetchRepoOptions
): Promise<Repository> {
  const postQueryWithToken = (payload) => postQuery(payload, token);
  const resolvedId: Schema.ObjectId = await resolveRepositoryGraphqlId(
    postQueryWithToken,
    repoId
  );

  // Key the cache file against the RepoId, but make sure that the
  // name is valid and uniquely identifying even on case-insensitive
  // filesystems (HFS, HFS+, APFS, NTFS) or filesystems preventing
  // equals signs in file names.
  const db: Database = await cache.database(cacheIdForRepoId(repoId));
  const mirror = new Mirror(db, schema(), {
    guessTypename: _guessTypename,
  });
  mirror.registerObject({typename: "Repository", id: resolvedId});

  // These are arbitrary tuning parameters.
  // TODO(#638): Design a configuration system for plugins.
  const ttlSeconds = 60 * 60 * 12;
  const nodesLimit = 100;
  const connectionLimit = 100;

  await mirror.update(postQueryWithToken, {
    since: new Date(Date.now() - ttlSeconds * 1000),
    now: () => new Date(),
    // These properties are arbitrary tuning parameters.
    nodesLimit,
    connectionLimit,
    // These values are the maxima allowed by GitHub.
    nodesOfTypeLimit: 100,
    connectionPageSize: 100,
  });
  return ((mirror.extract(resolvedId): any): Repository);
}

// GitHub object IDs are urlsafe-base64-encoded strings that decode to
// ASCII strings of the form "123:Typename4567[...]", where the "123"
// numbers are a function only of the typename and the "4567" numbers
// are the object's database ID, and the "[...]" is either empty or a
// further section like ":commithash" for commits.
//
// See tests for `_guessTypename` for some example object IDs.
const GITHUB_ID_TYPENAME_PATTERN = /^[0-9]*:([a-z0-9_-]*[a-z_-])[0-9]+(?:[^a-z0-9_-].*)?$/i;

export function _guessTypename(
  objectId: Schema.ObjectId
): Schema.Typename | null {
  const decodedId = Buffer.from(objectId, "base64").toString("utf-8");
  const match = decodedId.match(GITHUB_ID_TYPENAME_PATTERN);
  return match ? match[1] : null;
}

const GITHUB_GRAPHQL_SERVER = "https://api.github.com/graphql";

type GithubResponseError =
  | {|+type: "FETCH_ERROR", error: Error|}
  | {|+type: "GRAPHQL_ERROR", error: {errors: [{|message: string|}]}|}
  | {|+type: "RATE_LIMIT_EXCEEDED", error: mixed|}
  | {|+type: "GITHUB_INTERNAL_EXECUTION_ERROR", error: mixed|}
  | {|+type: "BAD_CREDENTIALS", error: mixed|}
  | {|+type: "NO_DATA", error: mixed|};

// Fetch against the GitHub API with the provided options, returning a
// promise that either resolves to the GraphQL result data or rejects
// to a `GithubResponseError`.
function tryGithubFetch(postBody: string, token: GithubToken): Promise<any> {
  const fetchOptions = {
    method: "POST",
    body: postBody,
    headers: {
      Authorization: `bearer ${token}`,
    },
  };
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
                error: x,
              }: GithubResponseError)
            );
          } else if (
            x.errors.length === 1 &&
            x.errors[0].type === "RATE_LIMITED"
          ) {
            return Promise.reject(
              ({type: "RATE_LIMIT_EXCEEDED", error: x}: GithubResponseError)
            );
          } else {
            return Promise.reject(
              ({type: "GRAPHQL_ERROR", error: x}: GithubResponseError)
            );
          }
        }
        if (x.data === undefined) {
          if (x.message && x.message.includes("Bad credentials")) {
            return Promise.reject(
              ({type: "BAD_CREDENTIALS", error: x}: GithubResponseError)
            );
          } else {
            // See https://github.com/sourcecred/sourcecred/issues/350
            return Promise.reject(
              ({type: "NO_DATA", error: x}: GithubResponseError)
            );
          }
        }
        return Promise.resolve(x.data);
      }),
    (e) =>
      Promise.reject(({type: "FETCH_ERROR", error: e}: GithubResponseError))
  );
}

async function errorDisposition(
  e: GithubResponseError,
  token: GithubToken
): Promise<AttemptOutcome<empty, GithubResponseError>> {
  if (
    e.type === "FETCH_ERROR" ||
    e.type === "GRAPHQL_ERROR" ||
    e.type === "BAD_CREDENTIALS"
  ) {
    return {type: "FATAL", err: e};
  }
  if (e.type === "GITHUB_INTERNAL_EXECUTION_ERROR" || e.type === "NO_DATA") {
    return {type: "RETRY", err: e};
  }
  if (e.type === "RATE_LIMIT_EXCEEDED") {
    try {
      const nominalRefreshTime = await quotaRefreshAt(token);
      const refreshTime = _resolveRefreshTime(new Date(), nominalRefreshTime);
      console.warn(
        "GitHub rate limit exceeded; waiting for refresh at " +
          refreshTime.toISOString()
      );
      return {type: "WAIT", until: refreshTime, err: e};
    } catch (refreshError) {
      // Fall back to waiting in 15-minute increments.
      console.warn("GitHub rate limit exceeded; waiting 15 minutes");
      const delayMs = 15 * 60 * 1000;
      return {type: "WAIT", until: new Date(Date.now() + delayMs), err: e};
    }
  }
  throw new Error((e.type: empty));
}

/**
 * Determine the instant at which our GitHub quota will refresh.
 *
 * The returned promise may reject with a `GithubResponseError` or
 * string error message.
 */
async function quotaRefreshAt(token: GithubToken): Promise<Date> {
  const b = Queries.build;
  const query = b.query(
    "RateLimitReset",
    [],
    [b.field("rateLimit", {}, [b.field("resetAt")])]
  );
  const postBody = JSON.stringify({
    query: stringify.body([query], inlineLayout()),
    variables: {},
  });
  const data = await tryGithubFetch(postBody, token);
  const dateString = data.rateLimit.resetAt;
  const result = new Date(dateString);
  if (isNaN(result)) {
    throw "got NaN quota reset time: " + JSON.stringify(data);
  }
  return result;
}

/**
 * Given a `resetAt` date response from GitHub, determine the actual
 * date until which we want to wait. We clamp to a reasonable range and
 * apply some padding.
 */
export function _resolveRefreshTime(now: Date, nominalRefreshTime: Date): Date {
  let delayMs = +nominalRefreshTime - +now;
  const [minDelayMs, maxDelayMs] = [0, 60 * 60 * 1000];
  if (delayMs < minDelayMs || delayMs > maxDelayMs) {
    const newDelayMs = Math.max(minDelayMs, Math.min(delayMs, maxDelayMs));
    console.warn(
      `clamping refresh delay from ${delayMs} ms to ${newDelayMs} ms`
    );
    delayMs = newDelayMs;
  }
  delayMs += 60 * 1000; // add 1 minute for padding around clock skew
  return new Date(+now + delayMs);
}

async function retryGithubFetch(
  postBody: string,
  token: GithubToken
): Promise<any /* or rejects to GithubResponseError */> {
  const policy = {
    maxRetries: 5,
    jitterRatio: 1.2,
    // We wait in 15-minute intervals, and quotas reset every hour, so
    // we shouldn't give up before waiting 4 times.
    maxWaits: 4,
  };
  const retryResult = await retry(async () => {
    try {
      return {type: "DONE", value: await tryGithubFetch(postBody, token)};
    } catch (errAny) {
      const err: GithubResponseError = errAny;
      return await errorDisposition(err, token);
    }
  }, policy);
  switch (retryResult.type) {
    case "DONE":
      return retryResult.value;
    case "FAILED":
      throw retryResult.err;
    default:
      throw new Error((retryResult.type: empty));
  }
}

export async function postQuery(
  {body, variables}: {+body: Body, +variables: mixed},
  token: GithubToken
): Promise<any> {
  const postBody = JSON.stringify({
    query: stringify.body(body, inlineLayout()),
    variables: variables,
  });
  return retryGithubFetch(postBody, token).catch(
    (error: GithubResponseError) => {
      switch (error.type) {
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
            "Unexpected GraphQL error: " + error.error.errors[0].message
            /* JSON.stringify({postBody: postBody, error: error.error} */
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
        case "BAD_CREDENTIALS":
          console.error(
            "An invalid token was supplied ($SOURCECRED_GITHUB_TOKEN). This is mostly likely caused by supplying a revoked token."
          );
          break;
        default:
          console.error(
            "Unexpected GitHub Error: " +
              JSON.stringify({postBody: postBody, error: error})
          );
      }
      return Promise.reject(error);
    }
  );
}

async function resolveRepositoryGraphqlId(
  postQuery: ({+body: Body, +variables: mixed}) => Promise<any>,
  repoId: RepoId
): Promise<Schema.ObjectId> {
  const b = Queries.build;
  const payload = {
    body: [
      b.query(
        "ResolveRepositoryId",
        [b.param("owner", "String!"), b.param("name", "String!")],
        [
          b.field(
            "repository",
            {owner: b.variable("owner"), name: b.variable("name")},
            [b.field("id")]
          ),
        ]
      ),
    ],
    variables: {owner: repoId.owner, name: repoId.name},
  };
  const data: {|+repository: null | {|+id: string|}|} = await postQuery(
    payload
  );
  if (data.repository == null) {
    throw new Error(
      `No such repository: ${repoIdToString(repoId)} ` +
        `(response data: ${JSON.stringify(data)})`
    );
  }
  return data.repository.id;
}
