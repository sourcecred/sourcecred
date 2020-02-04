// @flow

import {TaskReporter} from "../../util/taskReporter";
import {type CacheProvider} from "../../backend/cache";
import {type PluginDeclaration} from "../../analysis/pluginDeclaration";
import {type GithubToken} from "./token";
import {declaration} from "./declaration";
import {type RepoId, repoIdToString} from "./repoId";
import {default as fetchGithubRepo} from "./fetchGithubRepo";

export interface Loader {
  declaration(): PluginDeclaration;
  updateMirror(
    repoIds: $ReadOnlyArray<RepoId>,
    token: GithubToken,
    cache: CacheProvider,
    reporter: TaskReporter
  ): Promise<void>;
}

export default ({
  declaration: () => declaration,
  updateMirror,
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
