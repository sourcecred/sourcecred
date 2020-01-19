// @flow

import {TaskReporter} from "../../util/taskReporter";
import {fetchGithubRepoFromCache} from "./fetchGithubRepo";
import fetchGithubRepo from "./fetchGithubRepo";
import {RelationalView} from "./relationalView";
import {createGraph as _createGraph} from "./createGraph";
import {Graph} from "../../core/graph";
import {type RepoId, repoIdToString} from "./repoId";
import {type GithubToken} from "./token";
import {type CacheProvider} from "../../backend/cache";

export interface GithubLoader {
  updateMirror(
    repoIds: $ReadOnlyArray<RepoId>,
    token: GithubToken,
    cache: CacheProvider,
    reporter: TaskReporter
  ): Promise<void>;

  createGraph(
    repoIds: $ReadOnlyArray<RepoId>,
    token: GithubToken,
    cache: CacheProvider
  ): Promise<Graph>;
}

export const githubLoader: GithubLoader = {updateMirror, createGraph};

export async function updateMirror(
  repoIds: $ReadOnlyArray<RepoId>,
  token: GithubToken,
  cache: CacheProvider,
  reporter: TaskReporter
): Promise<void> {
  for (const repoId of repoIds) {
    const taskId = `github/${repoIdToString(repoId)}`;
    reporter.start(taskId);
    await fetchGithubRepo(repoId, {
      token: token,
      cacheDirectory: "unused_legacy",
      cache,
    });
    reporter.finish(taskId);
  }
}

export async function createGraph(
  repoIds: $ReadOnlyArray<RepoId>,
  token: GithubToken,
  cache: CacheProvider
): Promise<Graph> {
  const repositories = [];
  for (const repoId of repoIds) {
    repositories.push(await fetchGithubRepoFromCache(repoId, token, cache));
  }
  return Graph.merge(
    repositories.map((r) => {
      const rv = new RelationalView();
      rv.addRepository(r);
      return _createGraph(rv);
    })
  );
}
