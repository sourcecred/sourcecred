// @flow

import deepFreeze from "deep-freeze";
import * as Github from "../plugins/github/declaration";
import type {TimelineCredConfig} from "../analysis/timeline/timelineCred";

export const DEFAULT_CRED_CONFIG: TimelineCredConfig = deepFreeze({
  scoreNodePrefix: Github.userNodeType.prefix,
  filterNodePrefixes: [Github.userNodeType.prefix, Github.repoNodeType.prefix],
  types: {
    nodeTypes: Github.declaration.nodeTypes.slice(),
    edgeTypes: Github.declaration.edgeTypes.slice(),
  },
});
