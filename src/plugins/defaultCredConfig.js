// @flow

import deepFreeze from "deep-freeze";
import {userNodeType, repoNodeType, declaration} from "./github/declaration";
import type {TimelineCredConfig} from "../analysis/timeline/timelineCred";

export const DEFAULT_CRED_CONFIG: TimelineCredConfig = deepFreeze({
  scoreNodePrefix: userNodeType.prefix,
  filterNodePrefixes: [userNodeType.prefix, repoNodeType.prefix],
  types: {
    nodeTypes: declaration.nodeTypes.slice(),
    edgeTypes: declaration.edgeTypes.slice(),
  },
});
