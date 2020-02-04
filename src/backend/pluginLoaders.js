//@flow

import {TaskReporter} from "../util/taskReporter";
import {type Project} from "../core/project";
import {type WeightedGraph as WeightedGraphT} from "../core/weightedGraph";
import {type PluginDeclaration} from "../analysis/pluginDeclaration";
import {type CacheProvider} from "./cache";
import {type GithubToken} from "../plugins/github/token";
import {type Loader as GithubLoader} from "../plugins/github/loader";
import {type Loader as IdentityLoader} from "../plugins/identity/loader";
import {type Loader as DiscourseLoader} from "../plugins/discourse/loader";

/**
 * A type combining all known plugin Loader interfaces.
 *
 * Using this allows us to define "for all plugins" semantics, while keeping
 * each underlying plugin's interface flexible.
 */
export type PluginLoaders = {|
  +github: GithubLoader,
  +discourse: DiscourseLoader,
  +identity: IdentityLoader,
|};

/**
 * Represents a Project which has been mirrored into the CacheProvider.
 *
 * Note: no guarantees about the cache are made, it's state is a best effort.
 */
opaque type CachedProject = {|
  +cache: CacheProvider,
  +project: Project,
|};

/**
 * Represents all disjoint WeightedGraphs for a CachedProject.
 */
opaque type PluginGraphs = {|
  +graphs: $ReadOnlyArray<WeightedGraphT>,
  +cachedProject: CachedProject,
|};

type MirrorEnv = {
  +githubToken: ?GithubToken,
  +reporter: TaskReporter,
  +cache: CacheProvider,
};

type GraphEnv = {
  +githubToken: ?GithubToken,
};

/**
 * Gets all relevant PluginDeclarations for a given Project.
 */
export function declarations(
  {github, discourse, identity}: PluginLoaders,
  project: Project
): $ReadOnlyArray<PluginDeclaration> {
  const plugins: PluginDeclaration[] = [];
  if (project.repoIds.length) {
    plugins.push(github.declaration());
  }
  if (project.discourseServer != null) {
    plugins.push(discourse.declaration());
  }
  if (project.identities.length) {
    plugins.push(identity.declaration());
  }
  return plugins;
}

/**
 * Updates all mirrors into cache as requested by the Project.
 */
export async function updateMirror(
  {github, discourse}: PluginLoaders,
  {githubToken, cache, reporter}: MirrorEnv,
  project: Project
): Promise<CachedProject> {
  const tasks: Promise<void>[] = [];
  if (project.discourseServer) {
    tasks.push(
      discourse.updateMirror(project.discourseServer, cache, reporter)
    );
  }
  if (project.repoIds.length) {
    if (!githubToken) {
      throw new Error("Tried to load GitHub, but no GitHub token set");
    }
    tasks.push(
      github.updateMirror(project.repoIds, githubToken, cache, reporter)
    );
  }
  await Promise.all(tasks);
  return {project, cache};
}

/**
 * Creates PluginGraphs containing all plugins requested by the Project.
 */
export async function createPluginGraphs(
  {github, discourse}: PluginLoaders,
  {githubToken}: GraphEnv,
  {cache, project}: CachedProject
): Promise<PluginGraphs> {
  const tasks: Promise<WeightedGraphT>[] = [];
  if (project.discourseServer) {
    tasks.push(discourse.createGraph(project.discourseServer, cache));
  }
  if (project.repoIds.length) {
    if (!githubToken) {
      throw new Error("Tried to load GitHub, but no GitHub token set");
    }
    tasks.push(github.createGraph(project.repoIds, githubToken, cache));
  }

  // It's important to use Promise.all so that we can load the plugins in
  // parallel -- since loading is often IO-bound, this can be a big performance
  // improvement.
  return {
    graphs: await Promise.all(tasks),
    cachedProject: {cache, project},
  };
}
