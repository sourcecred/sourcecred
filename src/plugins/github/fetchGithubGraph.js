// @flow
/*
 * API to scrape data from a GitHub repo using the GitHub API. See the
 * docstring of the default export for more details.
 */

import type {NodePayload, EdgePayload} from "./types";
import type {Graph} from "@/core/graph";
import fetchGithubRepo from "./fetchGithubRepo";
import {parse} from "./parser";

/**
 * Scrape data from a GitHub repo, and return a SourceCred contribution graph.
 *
 * @param {String} repoOwner
 *    the GitHub username of the owner of the repository to be scraped
 * @param {String} repoName
 *    the name of the repository to be scraped
 * @param {String} token
 *    authentication token to be used for the GitHub API; generate a
 *    token at: https://github.com/settings/tokens
 * @return {Promise<Graph<NodePayload, EdgePayload>}
 *    a promise that resolves to a GitHub contribution graph
 */
export default function fetchGithubGraph(
  repoOwner: string,
  repoName: string,
  token: string
): Promise<Graph<NodePayload, EdgePayload>> {
  return fetchGithubRepo(repoOwner, repoName, token).then((x) => parse(x));
}
