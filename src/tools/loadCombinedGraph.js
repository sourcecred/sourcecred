// @flow

import cloneGitGraph from "../plugins/git/cloneGitGraph";
import fetchGithubGraph from "../plugins/github/fetchGithubGraph";
import type {
  NodePayload as GithubNodePayload,
  EdgePayload as GithubEdgePayload,
} from "../plugins/github/types";
import type {
  NodePayload as GitNodePayload,
  EdgePayload as GitEdgePayload,
} from "../plugins/git/types";
import {Graph} from "../core/graph";

export type NodePayload = GitNodePayload | GithubNodePayload;
export type EdgePayload = GitEdgePayload | GithubEdgePayload;
/**
 * Load a cross-plugin contribution graph for the given GitHub repo
 *
 * @param {String} repoOwner
 *   the GitHub username of the owner of the repository to be cloned
 * @param {String} repoName
 *   the name of the repository to be cloned
 * @return {Promise<Graph>}
 *   a Promise containing the combined contribution graph
 */
export function loadCombinedGraph(
  repoOwner: string,
  repoName: string,
  token: string
): Promise<Graph> {
  const githubGraphPromise = fetchGithubGraph(repoOwner, repoName, token);
  const gitGraph = cloneGitGraph(repoOwner, repoName);
  return githubGraphPromise.then((x) => Graph.mergeConservative(gitGraph, x));
}
