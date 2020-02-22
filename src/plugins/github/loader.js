// @flow

import {TaskReporter} from "../../util/taskReporter";
import {type CacheProvider} from "../../backend/cache";
import {type WeightedGraph} from "../../core/weightedGraph";
import {type ReferenceDetector} from "../../core/references";
import {type PluginDeclaration} from "../../analysis/pluginDeclaration";
import {type GithubToken} from "./token";
import {Graph} from "../../core/graph";
import {declaration} from "./declaration";
import {type RepoId, repoIdToString} from "./repoId";
import {createGraph as _createGraph} from "./createGraph";
import {RelationalView} from "./relationalView";
import {weightsForDeclaration} from "../../analysis/pluginDeclaration";
import {
  default as fetchGithubRepo,
  fetchGithubRepoFromCache,
} from "./fetchGithubRepo";
import {fromRelationalViews as referenceDetectorFromRelationalViews} from "./referenceDetector";

export interface Loader {
  declaration(): PluginDeclaration;
  updateMirror(
    repoIds: $ReadOnlyArray<RepoId>,
    token: GithubToken,
    cache: CacheProvider,
    reporter: TaskReporter
  ): Promise<void>;
  referenceDetector(
    repoIds: $ReadOnlyArray<RepoId>,
    token: GithubToken,
    cache: CacheProvider
  ): Promise<ReferenceDetector>;
  createGraph(
    repoIds: $ReadOnlyArray<RepoId>,
    token: GithubToken,
    cache: CacheProvider
  ): Promise<WeightedGraph>;
}

export default ({
  declaration: () => declaration,
  referenceDetector,
  updateMirror,
  createGraph,
}: Loader);

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
      cache,
    });
    reporter.finish(taskId);
  }
}

export async function referenceDetector(
  repoIds: $ReadOnlyArray<RepoId>,
  token: GithubToken,
  cache: CacheProvider
): Promise<ReferenceDetector> {
  const rvs = [];
  for (const repoId of repoIds) {
    const repo = await fetchGithubRepoFromCache(repoId, {token, cache});
    const rv = new RelationalView();
    rv.addRepository(repo);
    rvs.push(rv);
  }
  return referenceDetectorFromRelationalViews(rvs);
}

export async function createGraph(
  repoIds: $ReadOnlyArray<RepoId>,
  token: GithubToken,
  cache: CacheProvider
): Promise<WeightedGraph> {
  const repositories = [];
  for (const repoId of repoIds) {
    repositories.push(await fetchGithubRepoFromCache(repoId, {token, cache}));
  }
  const graph = Graph.merge(
    repositories.map((r) => {
      const rv = new RelationalView();
      rv.addRepository(r);
      return _createGraph(rv);
    })
  );
  const weights = weightsForDeclaration(declaration);
  return {graph, weights};
}
