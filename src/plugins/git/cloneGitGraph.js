// @flow

import cloneAndLoadRepository from "./cloneAndLoadRepository";
import {createGraph} from "./createGraph";
import type {NodePayload, EdgePayload} from "./types";
import type {Graph} from "core/graph";

/**
 * Load Git contribution graph from a fresh clone of a GitHub repo.
 *
 * @param {String} repoOwner
 *   the GitHub username of the owner of the repository to be cloned
 * @param {String} repoName
 *   the name of the repository to be cloned
 * @return {Graph<NodePayload, EdgePayload>}
 *   the Git contribution graph
 */
export default function fetchGitGraph(
  repoOwner: string,
  repoName: string
): Graph<NodePayload, EdgePayload> {
  const repo = cloneAndLoadRepository(repoOwner, repoName);
  return createGraph(repo);
}
