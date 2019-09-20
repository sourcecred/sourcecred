// @flow

import fs from "fs-extra";
import path from "path";

import {TaskReporter} from "../util/taskReporter";
import {Graph} from "../core/graph";
import {loadGraph} from "../plugins/github/loadGraph";
import {TimelineCred} from "../analysis/timeline/timelineCred";
import {defaultParams, partialParams} from "../analysis/timeline/params";
import {type TimelineCredParameters} from "../analysis/timeline/params";

import {type Project} from "../core/project";
import {setupProjectDirectory} from "../core/project_io";
import {loadDiscourse} from "../plugins/discourse/loadDiscourse";
import {type PluginDeclaration} from "../analysis/pluginDeclaration";
import * as NullUtil from "../util/null";
import {nodeContractions} from "../plugins/identity/nodeContractions";

export type LoadOptions = {|
  +project: Project,
  +params: ?$Shape<TimelineCredParameters>,
  +plugins: $ReadOnlyArray<PluginDeclaration>,
  +sourcecredDirectory: string,
  +githubToken: string | null,
  +discourseKey: string | null,
|};

/**
 * Loads and computes cred for a project.
 *
 * Loads the combined Graph for the specified project, saves it to disk,
 * and computes cred for it using the provided TimelineCredParameters.
 *
 * A project directory will be created for the given project within the
 * provided sourcecredDirectory, using the APIs in core/project_io. Within this
 * project directory, there will be a `cred.json` file containing filtered
 * timeline cred, and a `graph.json` file containing the combined graph.
 *
 * In the future, we should consider splitting this into cleaner, more atomic
 * APIs (e.g. one for loading the graph; another for computing cred).
 */
export async function load(
  options: LoadOptions,
  taskReporter: TaskReporter
): Promise<void> {
  const {project, params, plugins, sourcecredDirectory, githubToken} = options;
  const fullParams = params == null ? defaultParams() : partialParams(params);
  const loadTask = `load-${options.project.id}`;
  taskReporter.start(loadTask);
  const cacheDirectory = path.join(sourcecredDirectory, "cache");
  await fs.mkdirp(cacheDirectory);

  function discourseGraph(): ?Promise<Graph> {
    const discourseServer = project.discourseServer;
    if (discourseServer != null) {
      const {serverUrl, apiUsername} = discourseServer;
      if (options.discourseKey == null) {
        throw new Error("Tried to load Discourse, but no Discourse key set");
      }
      const discourseOptions = {
        fetchOptions: {apiKey: options.discourseKey, serverUrl, apiUsername},
        cacheDirectory,
      };
      return loadDiscourse(discourseOptions, taskReporter);
    }
  }

  function githubGraph(): ?Promise<Graph> {
    if (project.repoIds.length) {
      if (githubToken == null) {
        throw new Error("Tried to load GitHub, but no GitHub token set.");
      }
      const githubOptions = {
        repoIds: project.repoIds,
        token: githubToken,
        cacheDirectory,
      };

      return loadGraph(githubOptions, taskReporter);
    }
  }

  // For each plugin that wants to provide a Graph, get a Promise for the
  // graph. That way we can request them in parallel, via Promise.all, rather
  // than blocking on the plugins sequentially.
  // Since plugins often perform rate-limited IO, this may be a big performance
  // improvement.
  const pluginGraphPromises: Promise<Graph>[] = NullUtil.filterList([
    discourseGraph(),
    githubGraph(),
  ]);

  const pluginGraphs = await Promise.all(pluginGraphPromises);
  let graph = Graph.merge(pluginGraphs);
  const {identities, discourseServer} = project;
  if (identities.length) {
    const serverUrl =
      discourseServer == null ? null : discourseServer.serverUrl;
    const contractions = nodeContractions(identities, serverUrl);
    // Only apply contractions if identities have been specified, since it involves
    // a full Graph copy
    graph = graph.contractNodes(contractions);
  }

  const projectDirectory = await setupProjectDirectory(
    project,
    sourcecredDirectory
  );
  const graphFile = path.join(projectDirectory, "graph.json");
  await fs.writeFile(graphFile, JSON.stringify(graph.toJSON()));

  taskReporter.start("compute-cred");
  const cred = await TimelineCred.compute({graph, params: fullParams, plugins});
  const credJSON = cred.toJSON();
  const credFile = path.join(projectDirectory, "cred.json");
  await fs.writeFile(credFile, JSON.stringify(credJSON));
  taskReporter.finish("compute-cred");
  taskReporter.finish(loadTask);
}
