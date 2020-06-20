//@flow

import {TaskReporter} from "../util/taskReporter";
import {type Project} from "../core/project";
import {type WeightedGraph as WeightedGraphT} from "../core/weightedGraph";
import * as WeightedGraph from "../core/weightedGraph";
import {type PluginDeclaration} from "../analysis/pluginDeclaration";
import {type CacheProvider} from "./cache";
import {type GithubToken} from "../plugins/github/token";
import {type DiscordToken} from "../plugins/experimental-discord/config";
import {type Loader as GithubLoader} from "../plugins/github/loader";
import {type Loader as DiscordLoader} from "../plugins/experimental-discord/loader";
import {type Loader as DiscourseLoader} from "../plugins/discourse/loader";
import {type Loader as IdentityLoader} from "../plugins/identity/loader";
import {type Loader as InitiativesLoader} from "../plugins/initiatives/loader";
import {type LoadedInitiativesDirectory} from "../plugins/initiatives/initiativesDirectory";
import {
  type ReferenceDetector,
  CascadingReferenceDetector,
} from "../core/references";
import {identityAddress} from "../plugins/identity/identity";

/**
 * A type combining all known plugin Loader interfaces.
 *
 * Using this allows us to define "for all plugins" semantics, while keeping
 * each underlying plugin's interface flexible.
 */
export type PluginLoaders = {|
  +github: GithubLoader,
  +discord: DiscordLoader,
  +discourse: DiscourseLoader,
  +identity: IdentityLoader,
  +initiatives: InitiativesLoader,
|};

/**
 * Represents a Project which has been mirrored into the CacheProvider.
 *
 * Note: no guarantees about the cache are made, it's state is a best effort.
 */
opaque type CachedProject = {|
  +loadedInitiativesDirectory: ?LoadedInitiativesDirectory,
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
  +initiativesDirectory: ?string,
  +githubToken: ?GithubToken,
  +discordToken: ?DiscordToken,
  +reporter: TaskReporter,
  +cache: CacheProvider,
};

type GraphEnv = {
  +githubToken: ?GithubToken,
  +discordToken: ?DiscordToken,
};

/**
 * Gets all relevant PluginDeclarations for a given Project.
 */
export function declarations(
  {github, discourse, discord, identity, initiatives}: PluginLoaders,
  project: Project
): $ReadOnlyArray<PluginDeclaration> {
  const plugins: PluginDeclaration[] = [];
  if (project.repoIds.length) {
    plugins.push(github.declaration());
  }
  if (project.discourseServer != null) {
    plugins.push(discourse.declaration());
  }
  if (project.discord != null) {
    plugins.push(discord.declaration());
  }
  if (project.identities.length) {
    plugins.push(identity.declaration());
  }
  if (project.initiatives) {
    plugins.push(initiatives.declaration());
  }
  return plugins;
}

/**
 * Updates all mirrors into cache as requested by the Project.
 */
export async function updateMirror(
  {github, discourse, discord, initiatives}: PluginLoaders,
  {githubToken, discordToken, cache, reporter, initiativesDirectory}: MirrorEnv,
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
  if (project.discord) {
    if (!discordToken) {
      throw new Error("Tried to load Discord, but no Discord bot token set");
    }
    tasks.push(
      discord.updateMirror(project.discord, discordToken, cache, reporter)
    );
  }

  let loadedInitiativesDirectory: ?LoadedInitiativesDirectory;
  if (project.initiatives) {
    if (!initiativesDirectory) {
      throw new Error(
        "Tried to load Initiatives, but no Initiatives directory set"
      );
    }
    loadedInitiativesDirectory = await initiatives.loadDirectory(
      {
        localPath: initiativesDirectory,
        remoteUrl: project.initiatives.remoteUrl,
      },
      reporter
    );
  }

  await Promise.all(tasks);
  return {project, cache, loadedInitiativesDirectory};
}

/**
 * Creates a ReferenceDetector composing all plugin reference detectors
 * requested by the project.
 */
export async function createReferenceDetector(
  {github, discourse}: $Shape<PluginLoaders>,
  {githubToken}: GraphEnv,
  {cache, project, loadedInitiativesDirectory}: CachedProject
): Promise<ReferenceDetector> {
  const refs: ReferenceDetector[] = [];
  if (project.repoIds.length) {
    // TODO: similar to create graph, rather not depend on the token (#1580).
    if (!githubToken) {
      throw new Error("Tried to load GitHub, but no GitHub token set");
    }
    refs.push(
      await github.referenceDetector(project.repoIds, githubToken, cache)
    );
  }
  if (project.discourseServer) {
    refs.push(
      await discourse.referenceDetector(project.discourseServer, cache)
    );
  }
  if (loadedInitiativesDirectory) {
    refs.push(loadedInitiativesDirectory.referenceDetector);
  }
  // Hack around for https://github.com/sourcecred/sourcecred/issues/1807
  // The current initiative format (and this code) are both deprecated, so not worried
  // about this being a long term solution -- just trying to unblock MetaGame
  if (project.identities) {
    const map = new Map();
    for (const {username} of project.identities) {
      map.set(`@${username}`, identityAddress(username));
    }
    refs.push({addressFromUrl: (url) => map.get(url)});
  }
  return new CascadingReferenceDetector(refs);
}

/**
 * Creates PluginGraphs containing all plugins requested by the Project.
 */
export async function createPluginGraphs(
  {github, discourse, discord, initiatives}: PluginLoaders,
  {githubToken, discordToken}: GraphEnv,
  {cache, project, loadedInitiativesDirectory}: CachedProject,
  referenceDetector: ReferenceDetector
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
  if (project.discord) {
    if (!discordToken) {
      throw new Error("Tried to load Discord, but no Discord bot token set");
    }
    tasks.push(discord.createGraph(project.discord, cache));
  }

  if (loadedInitiativesDirectory) {
    tasks.push(
      initiatives.createGraph(
        loadedInitiativesDirectory.initiatives,
        referenceDetector
      )
    );
  }

  // It's important to use Promise.all so that we can load the plugins in
  // parallel -- since loading is often IO-bound, this can be a big performance
  // improvement.
  return {
    graphs: await Promise.all(tasks),
    cachedProject: {cache, project, loadedInitiativesDirectory},
  };
}

/**
 * Takes PluginGraphs and merges it into a WeightedGraph with identities contracted.
 */
export async function contractPluginGraphs(
  {identity}: PluginLoaders,
  {graphs, cachedProject}: PluginGraphs
): Promise<WeightedGraphT> {
  const {project} = cachedProject;
  const mergedGraph = WeightedGraph.merge(graphs);

  // Don't contract when there's no identities. This will prevent unnecessary copying.
  if (!project.identities.length) {
    return mergedGraph;
  }

  const discourseServer = project.discourseServer || {serverUrl: null};
  const identitySpec = {
    identities: project.identities,
    discourseServerUrl: discourseServer.serverUrl,
  };
  return identity.contractIdentities(mergedGraph, identitySpec);
}
