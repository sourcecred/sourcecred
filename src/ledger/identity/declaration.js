// @flow

import {type PluginDeclaration} from "../../analysis/pluginDeclaration";
import {type NodeType} from "../../analysis/types";
import {NodeAddress, EdgeAddress} from "../../core/graph";

// It's not in the typical [owner, name] format because it isn't provided by a plugin.
// Instead, it's a raw type owned by SourceCred project.
export const IDENTITY_PREFIX = NodeAddress.fromParts([
  "sourcecred",
  "core",
  "IDENTITY",
]);

const identityNodeType: NodeType = {
  name: "identity",
  pluralName: "identities",
  defaultWeight: 0,
  description: "a canonical participant identity",
  prefix: IDENTITY_PREFIX,
};
const nodeTypes = [identityNodeType];

export const declaration: PluginDeclaration = {
  name: "Identity",
  nodePrefix: IDENTITY_PREFIX,
  edgePrefix: EdgeAddress.fromParts(["sourcecred", "core", "IDENTITY"]),
  nodeTypes,
  userTypes: nodeTypes,
  edgeTypes: [],
};
