//@flow

import {type CacheProvider} from "./cache";
import {type MirrorPlan, type GraphPlan} from "./loadPlan";
import {Graph} from "../core/graph";
import {type Project} from "../core/project";
import {TaskReporter} from "../util/taskReporter";
import {type GithubToken} from "../plugins/github/token";
import {type GithubLoader} from "../plugins/github/loader";
import {type IdentityLoader} from "../plugins/identity/loader";
import {type DiscourseLoader} from "../plugins/discourse/loader";

export type PluginLoaders = {|
  +github: GithubLoader,
  +discourse: DiscourseLoader,
  +identity: IdentityLoader,
|};

export function pluginMirrorPlan(
  {github, discourse}: PluginLoaders,
  githubToken: ?GithubToken,
  cache: CacheProvider,
  reporter: TaskReporter
): MirrorPlan {
  return async (project: Project): Promise<void> => {
    const tasks: Promise<void>[] = [];

    if (project.discourseServer) {
      tasks.push(
        discourse.updateMirror(project.discourseServer, cache, reporter)
      );
    }

    if (project.repoIds.length) {
      if (!githubToken) throw new Error("GithubToken not set");
      tasks.push(
        github.updateMirror(project.repoIds, githubToken, cache, reporter)
      );
    }

    await Promise.all(tasks);
  };
}

export function pluginGraphPlan(
  {github, discourse, identity}: PluginLoaders,
  githubToken: ?GithubToken,
  cache: CacheProvider
): GraphPlan {
  return async (project: Project): Promise<Graph> => {
    const tasks: Promise<Graph>[] = [];

    if (project.discourseServer) {
      tasks.push(discourse.createGraph(project.discourseServer, cache));
    }

    if (project.repoIds.length) {
      if (!githubToken) throw new Error("GithubToken not set");
      tasks.push(github.createGraph(project.repoIds, githubToken, cache));
    }

    const pluginGraphs = await Promise.all(tasks);
    let graph = Graph.merge(pluginGraphs);

    if (project.identities.length) {
      const {serverUrl} = project.discourseServer || {serverUrl: null};
      graph = identity.contractGraph(graph, project.identities, serverUrl);
    }

    return graph;
  };
}
