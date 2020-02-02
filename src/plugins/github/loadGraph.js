// @flow

// This module is deprecated, and is being replaced by
// github/loadWeightedGraph. Over the course of finishing #1557,
// @decentralion will remove this module and merge its implementation into
// loadWeightedGraph.
//
// This module is untested, because it is an IO-heavy composition of pieces of
// functionality which are individually quite well tested.

import {TaskReporter} from "../../util/taskReporter";
import {createGraph} from "./createGraph";
import {
  default as fetchGithubRepo,
  fetchGithubRepoFromCache,
} from "./fetchGithubRepo";
import {RelationalView} from "./relationalView";
import {type RepoId, repoIdToString} from "./repoId";
import {Graph} from "../../core/graph";
import {type GithubToken} from "./token";
import {type CacheProvider} from "../../backend/cache";

export type Options = {|
  +repoIds: $ReadOnlyArray<RepoId>,
  +token: GithubToken,
  +cache: CacheProvider,
|};

/**
 * Loads several GitHub repositories, combining them into a single graph.
 */
export async function loadGraph(
  options: Options,
  taskReporter: TaskReporter
): Promise<Graph> {
  // We intentionally fetch repositories sequentially rather than in
  // parallel, because GitHub asks that we not make concurrent
  // requests. From <https://archive.is/LlkQp#88%>:
  //
  // > Make requests for a single user or client ID serially. Do not make
  // > make requests for a single user or client ID concurrently.
  const repositories = [];
  for (const repoId of options.repoIds) {
    const taskId = `github/${repoIdToString(repoId)}`;
    taskReporter.start(taskId);
    repositories.push(
      await fetchGithubRepo(repoId, {
        token: options.token,
        cache: options.cache,
      }).then((_) =>
        fetchGithubRepoFromCache(repoId, {
          token: options.token,
          cache: options.cache,
        })
      )
    );
    taskReporter.finish(taskId);
  }
  return Graph.merge(
    repositories.map((r) => {
      const rv = new RelationalView();
      rv.addRepository(r);
      return createGraph(rv);
    })
  );
}
