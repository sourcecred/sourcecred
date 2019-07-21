// @flow

import {TaskReporter} from "../../util/taskReporter";
import {createGraph} from "./createGraph";
import fetchGithubRepo from "./fetchGithubRepo";
import {RelationalView} from "./relationalView";
import {type RepoId, repoIdToString} from "../../core/repoId";
import {Graph} from "../../core/graph";

export type Options = {|
  +repoIds: $ReadOnlyArray<RepoId>,
  +token: string,
  +cacheDirectory: string,
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
        cacheDirectory: options.cacheDirectory,
      })
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
