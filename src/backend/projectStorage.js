//@flow

import {type WeightedGraph} from "../core/weightedGraph";
import {TimelineCred} from "../analysis/timeline/timelineCred";
import {type Project} from "../core/project";
import {type PluginDeclarations} from "../analysis/pluginDeclaration";
import {type OutputV1} from "../analysis/output";

export type ProjectStorageExtras = {
  +weightedGraph?: WeightedGraph,
  +cred?: TimelineCred,
  +pluginDeclarations?: PluginDeclarations,
  +output: OutputV1,
};

export interface ProjectStorageProvider {
  storeProject(project: Project, extras: ProjectStorageExtras): Promise<void>;
}
