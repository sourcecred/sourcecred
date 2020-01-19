//@flow

import {Graph} from "../core/graph";
import {TimelineCred} from "../analysis/timeline/timelineCred";
import {type Project} from "../core/project";

export type ProjectStorageExtras = {
  +graph?: Graph,
  +cred?: TimelineCred,
};

export interface ProjectStorageProvider {
  storeProject(project: Project, extras: ProjectStorageExtras): Promise<void>;
}
