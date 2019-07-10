// @flow

import {userNodeType, repoNodeType, declaration} from "./github/declaration";
import type {TimelineCredConfig} from "../analysis/timeline/timelineCred";

export const DEFAULT_CRED_CONFIG: TimelineCredConfig = {
  scoreNodePrefix: userNodeType.prefix,
  filterNodePrefixes: Object.freeze([userNodeType.prefix, repoNodeType.prefix]),
  types: Object.freeze({
    nodeTypes: Object.freeze(declaration.nodeTypes.slice()),
    edgeTypes: Object.freeze(declaration.edgeTypes.slice()),
  }),
};
