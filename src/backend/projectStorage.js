//@flow

import {type WeightedGraph} from "../core/weightedGraph";
import {TimelineCred} from "../analysis/timeline/timelineCred";
import {type Project} from "../core/project";
import {type PluginDeclarations} from "../analysis/pluginDeclaration";

export type ProjectStorageExtras = {
  +weightedGraph?: WeightedGraph,
  +cred?: TimelineCred,
  +pluginDeclarations?: PluginDeclarations,
};

export interface ProjectStorageProvider {
  storeProject(project: Project, extras: ProjectStorageExtras): Promise<void>;
}
