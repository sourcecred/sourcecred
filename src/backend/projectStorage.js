//@flow

import {type WeightedGraph} from "../core/weightedGraph";
import {TimelineCred} from "../analysis/timeline/timelineCred";
import {type Project} from "../core/project";

export type ProjectStorageExtras = {
  +weightedGraph?: WeightedGraph,
  +cred?: TimelineCred,
};

export interface ProjectStorageProvider {
  storeProject(project: Project, extras: ProjectStorageExtras): Promise<void>;
}
