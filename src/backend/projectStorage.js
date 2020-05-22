//@flow

import {type WeightedGraph} from "../core/weightedGraph";
import {TimelineCred} from "../analysis/timeline/timelineCred";
import {type Project} from "../core/project";
import {type PluginDeclarations} from "../analysis/pluginDeclaration";
import {type Output} from "../analysis/output";

export type ProjectStorageExtras = {
  +weightedGraph?: WeightedGraph,
  +cred?: TimelineCred,
  +pluginDeclarations?: PluginDeclarations,
  +output: Output,
};

export interface ProjectStorageProvider {
  storeProject(project: Project, extras: ProjectStorageExtras): Promise<void>;
}
