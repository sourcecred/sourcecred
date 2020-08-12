// @flow

import {type PluginDeclaration} from "../../analysis/pluginDeclaration";
import {type NodeType} from "../../analysis/types";
import {NodeAddress, EdgeAddress} from "../../core/graph";

// It's not in the typical [owner, login] format because it isn't provided by a plugin.
// Instead, it's a raw type owned by SourceCred project.
export const IDENTITY_PREFIX = NodeAddress.fromParts([
  "sourcecred",
  "core",
  "IDENTITY",
]);

const userNodeType: NodeType = {
  name: "user",
  pluralName: "users",
  defaultWeight: 0,
  description: "a canonical user identity",
  prefix: NodeAddress.append(IDENTITY_PREFIX, "USER"),
};
const projectNodeType: NodeType = {
  name: "project",
  pluralName: "projects",
  defaultWeight: 0,
  description: "a canonical project identity",
  prefix: NodeAddress.append(IDENTITY_PREFIX, "PROJECT"),
};
const organizationNodeType: NodeType = {
  name: "organization",
  pluralName: "organizations",
  defaultWeight: 0,
  description: "a canonical organization identity",
  prefix: NodeAddress.append(IDENTITY_PREFIX, "ORGANIZATION"),
};
const botNodeType: NodeType = {
  name: "bot",
  pluralName: "bots",
  defaultWeight: 0,
  description: "a canonical bot identity",
  prefix: NodeAddress.append(IDENTITY_PREFIX, "BOT"),
};
const nodeTypes = [
  userNodeType,
  projectNodeType,
  organizationNodeType,
  botNodeType,
];

export const declaration: PluginDeclaration = {
  name: "Identity",
  nodePrefix: IDENTITY_PREFIX,
  edgePrefix: EdgeAddress.fromParts(["sourcecred", "core", "IDENTITY"]),
  nodeTypes,
  userTypes: nodeTypes,
  edgeTypes: [],
};
