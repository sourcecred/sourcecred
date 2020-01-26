// @flow
/**
 * Declaration for the SourceCred identity plugin.
 */
import deepFreeze from "deep-freeze";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import type {NodeType} from "../../analysis/types";
import {NodeAddress, EdgeAddress} from "../../core/graph";

export const nodePrefix = NodeAddress.fromParts(["sourcecred", "identity"]);
export const edgePrefix = EdgeAddress.fromParts(["sourcecred", "identity"]);

export const identityType: NodeType = deepFreeze({
  name: "Identity",
  pluralName: "Identities",
  prefix: nodePrefix,
  defaultWeight: 0,
  description: "A combined user identity as specified to SourceCred",
});

export const declaration: PluginDeclaration = deepFreeze({
  name: "Identity",
  nodePrefix,
  edgePrefix,
  nodeTypes: [identityType],
  edgeTypes: [],
  userTypes: [identityType],
});
