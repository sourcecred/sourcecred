// @flow

import fs from "fs-extra";
import path from "path";
import stringify from "json-stable-stringify";

import {TaskReporter} from "../util/taskReporter";
import {type GithubToken} from "../plugins/github/token";
import {TimelineCred} from "../analysis/timeline/timelineCred";
import {defaultParams, partialParams} from "../analysis/timeline/params";
import {type TimelineCredParameters} from "../analysis/timeline/params";

import {type Project} from "../core/project";
import {setupProjectDirectory} from "../core/project_io";
import {
  type PluginDeclaration,
  toJSON as pluginsToJSON,
} from "../analysis/pluginDeclaration";
import * as Discourse from "../plugins/discourse/loadWeightedGraph";
import * as Github from "../plugins/github/loadWeightedGraph";
import * as WeightedGraph from "../core/weightedGraph";
import {type Weights as WeightsT} from "../core/weights";
import {loadWeightedGraph} from "./loadWeightedGraph";
import {DataDirectory} from "../backend/dataDirectory";
import {type CacheProvider} from "../backend/cache";
import {LoadContext} from "../backend/loadContext";

export type LoadOptions = {|
  +project: Project,
  +params: ?$Shape<TimelineCredParameters>,
  +weightsOverrides: WeightsT,
  +plugins: $ReadOnlyArray<PluginDeclaration>,
  +sourcecredDirectory: string,
  +githubToken: ?GithubToken,
|};

export async function loadContext(
  options: LoadOptions,
  reporter: TaskReporter
): Promise<void> {
  const {
    sourcecredDirectory,
    githubToken,
    project,
    params,
    weightsOverrides,
  } = options;
  const data = new DataDirectory(sourcecredDirectory);
  const context = new LoadContext({cache: data, githubToken, reporter});
  const result = await context.load(project, {
    params: params || {},
    weightsOverrides,
  });
  data.storeProject(project, result);
}

/**
 * Loads and computes cred for a project.
 *
 * Loads the combined Graph for the specified project, saves it to disk,
 * and computes cred for it using the provided TimelineCredParameters.
 *
 * A project directory will be created for the given project within the
 * provided sourcecredDirectory, using the APIs in core/project_io. Within this
 * project directory, there will be a `cred.json` file containing filtered
 * timeline cred, and a `weightedGraph.json` file containing the combined graph.
 *
 * In the future, we should consider splitting this into cleaner, more atomic
 * APIs (e.g. one for loading the graph; another for computing cred).
 */
export async function load(
  options: LoadOptions,
  taskReporter: TaskReporter
): Promise<void> {
  const {
    project,
    params,
    plugins,
    sourcecredDirectory,
    githubToken,
    weightsOverrides,
  } = options;
  const {identities, discourseServer} = project;
  const fullParams = params == null ? defaultParams() : partialParams(params);
  const loadTask = `load-${options.project.id}`;
  taskReporter.start(loadTask);
  const dataDirectory = new DataDirectory(sourcecredDirectory);
  const cacheDirectory = path.join(sourcecredDirectory, "cache");
  await fs.mkdirp(cacheDirectory);

  let discourseOptions: ?Discourse.Options;
  if (discourseServer != null) {
    discourseOptions = {
      discourseServer,
      cacheDirectory,
    };
  }

  let githubOptions: ?Github.Options;
  if (project.repoIds.length) {
    if (githubToken == null) {
      throw new Error("Tried to load GitHub, but no GitHub token set.");
    }
    githubOptions = {
      repoIds: project.repoIds,
      token: githubToken,
      cache: (dataDirectory: CacheProvider),
    };
  }

  const identitySpec = {
    identities,
    discourseServerUrl:
      discourseServer == null ? null : discourseServer.serverUrl,
  };
  const weightedGraph = await loadWeightedGraph(
    {
      discourseOptions,
      githubOptions,
      identitySpec,
      weightsOverrides,
    },
    taskReporter
  );

  const projectDirectory = await setupProjectDirectory(
    project,
    sourcecredDirectory
  );
  const graphFile = path.join(projectDirectory, "weightedGraph.json");
  const graphJSON = WeightedGraph.toJSON(weightedGraph);
  await fs.writeFile(graphFile, stringify(graphJSON));

  const pluginsFile = path.join(projectDirectory, "pluginDeclarations.json");
  const pluginsJSON = pluginsToJSON(plugins);
  await fs.writeFile(pluginsFile, stringify(pluginsJSON));

  taskReporter.start("compute-cred");
  const cred = await TimelineCred.compute({
    weightedGraph,
    params: fullParams,
    plugins,
  });
  const credJSON = cred.toJSON();
  const credFile = path.join(projectDirectory, "cred.json");
  await fs.writeFile(credFile, stringify(credJSON));
  taskReporter.finish("compute-cred");
  taskReporter.finish(loadTask);
}
