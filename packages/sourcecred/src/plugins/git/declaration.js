// @flow

import deepFreeze from "deep-freeze";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import type {NodeType} from "../../analysis/types";
import * as N from "./nodes";
import * as E from "./edges";

const commitNodeType: NodeType = deepFreeze({
  name: "Commit",
  pluralName: "Commits",
  prefix: N.Prefix.commit,
  defaultWeight: 2,
  description: "NodeType representing a git commit",
});

const hasParentEdgeType = deepFreeze({
  forwardName: "has parent",
  backwardName: "is parent of",
  prefix: E.Prefix.hasParent,
  defaultWeight: {forwards: 1, backwards: 1},
  description: "Connects a Git commit to its parent commit(s).",
});

const nodeTypes = deepFreeze([commitNodeType]);
const edgeTypes = deepFreeze([hasParentEdgeType]);

export const declaration: PluginDeclaration = deepFreeze({
  name: "Git",
  nodePrefix: N.Prefix.base,
  edgePrefix: E.Prefix.base,
  nodeTypes,
  edgeTypes,
  userTypes: [],
});
