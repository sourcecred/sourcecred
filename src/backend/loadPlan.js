//@flow

import {Graph} from "../core/graph";
import {type Project} from "../core/project";
import {type TimelineCredParameters} from "../analysis/timeline/params";
import {TimelineCred} from "../analysis/timeline/timelineCred";
import {type PluginDeclaration} from "../analysis/pluginDeclaration";
import {type GithubToken} from "../plugins/github/token";
import {type CacheProvider} from "./cache";
import {timelineCredPlan} from "./timelineCredPlan";
import {pluginMirrorPlan, pluginGraphPlan} from "./pluginPlan";
import {TaskReporter} from "../util/taskReporter";
import {githubLoader} from "../plugins/github/loader";
import {identityLoader} from "../plugins/identity/loader";
import {discourseLoader} from "../plugins/discourse/loader";

/**
 * This file introduces a "plan" concept.
 *
 * A plan allows us to separate the large amount of dependency injection that's
 * necessary to load a SourceCred instance. It makes a hard distinction between
 * which arguments are environment-bound (like the TaskReporter, CacheProvider,
 * and GithubToken) and which are parameters for the load (like Project).
 *
 * A <Something>Plan type only includes the later *parameters for loading*,
 * because this Plan is typically the output of a factory function which curried
 * the environment-bound arguments for us.
 */

export type MirrorPlan = (project: Project) => Promise<void>;

export type GraphPlan = (project: Project) => Promise<Graph>;

export type CredComputationPlan = (
  graph: Graph,
  params: ?$Shape<TimelineCredParameters>
) => Promise<TimelineCred>;

export type LoadPlan = {|
  +mirror: MirrorPlan,
  +createGraph: GraphPlan,
  +computeCred: CredComputationPlan,
|};

export type LoadResult = {|
  +graph: Graph,
  +cred: TimelineCred,
|};

export function createPlan(
  cache: CacheProvider,
  githubToken: ?GithubToken,
  pluginDeclarations: $ReadOnlyArray<PluginDeclaration>,
  reporter: TaskReporter
): LoadPlan {
  const loaders = {
    github: githubLoader,
    discourse: discourseLoader,
    identity: identityLoader,
  };
  const mirror = pluginMirrorPlan(loaders, githubToken, cache, reporter);
  const createGraph = pluginGraphPlan(loaders, githubToken, cache);
  const computeCred = timelineCredPlan(
    pluginDeclarations,
    reporter,
    TimelineCred.compute
  );
  return {mirror, createGraph, computeCred};
}

export async function executePlan(
  plan: LoadPlan,
  project: Project,
  params: ?$Shape<TimelineCredParameters>
): Promise<LoadResult> {
  await plan.mirror(project);
  const graph = await plan.createGraph(project);
  const cred = await plan.computeCred(graph, params);
  return {graph, cred};
}
