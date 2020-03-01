// @flow

import {type Project} from "../core/project";
import {type Weights as WeightsT} from "../core/weights";
import {type PluginDeclaration} from "../analysis/pluginDeclaration";
import {type TimelineCredParameters} from "../analysis/timeline/params";
import {type GithubToken} from "../plugins/github/token";
import {type CacheProvider} from "../backend/cache";
import {DataDirectory} from "../backend/dataDirectory";
import {TaskReporter} from "../util/taskReporter";
import {LoadContext} from "../backend/loadContext";

export type LoadOptions = {|
  +project: Project,
  +params: ?$Shape<TimelineCredParameters>,
  +weightsOverrides: WeightsT,
  +plugins: $ReadOnlyArray<PluginDeclaration>,
  +sourcecredDirectory: string,
  +githubToken: ?GithubToken,
  +initiativesDirectory: ?string,
|};

/**
 * Loads and computes cred for a Project, storing the result in a DataDirectory.
 */
export async function load(
  options: LoadOptions,
  reporter: TaskReporter
): Promise<void> {
  const {
    sourcecredDirectory,
    githubToken,
    project,
    params,
    weightsOverrides,
    initiativesDirectory,
  } = options;
  const data = new DataDirectory(sourcecredDirectory);
  const context = new LoadContext({
    cache: (data: CacheProvider),
    githubToken,
    reporter,
    initiativesDirectory,
  });
  const result = await context.load(project, {
    params: params || {},
    weightsOverrides,
  });
  data.storeProject(project, result);
}
