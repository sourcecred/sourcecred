// @flow

import deepFreeze from "deep-freeze";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import {type PluginId, getPluginName, getPluginOwner} from "../../api/pluginId";
import {NodeAddress, EdgeAddress, type NodeAddressT} from "../../core/graph";

export function contributionNodeType(
  id: PluginId
): {|
  +defaultWeight: number,
  +description: string,
  +name: string,
  +pluralName: string,
  +prefix: NodeAddressT,
|} {
  return deepFreeze({
    name: "Contribution",
    pluralName: "Contributions",
    prefix: NodeAddress.fromParts([
      getPluginOwner(id),
      getPluginName(id),
      "CONTRIBUTION",
    ]),
    defaultWeight: 1,
    description: "NodeType for a generic contribution",
  });
}

export function participantNodeType(
  id: PluginId
): {|
  +defaultWeight: number,
  +description: string,
  +name: string,
  +pluralName: string,
  +prefix: NodeAddressT,
|} {
  return deepFreeze({
    name: "Participant",
    pluralName: "Participant",
    prefix: NodeAddress.fromParts([
      getPluginOwner(id),
      getPluginName(id),
      "PARTICIPANT",
    ]),
    defaultWeight: 1,
    description: "NodeType for a generic participant",
  });
}

function participatedInEdgeType(id: PluginId) {
  return deepFreeze({
    forwardName: "participated in",
    backwardName: "had participation from",
    defaultWeight: {forwards: 1 / 2, backwards: 1},
    prefix: EdgeAddress.fromParts([
      getPluginOwner(id),
      getPluginName(id),
      "PARTICIPATES_IN",
    ]),
    description: "NodeType for a generic participant-contribution relationship",
  });
}

export function declaration(id: PluginId): PluginDeclaration {
  return deepFreeze({
    name: getPluginName(id),
    nodePrefix: NodeAddress.fromParts([getPluginOwner(id), getPluginName(id)]),
    edgePrefix: EdgeAddress.fromParts([getPluginOwner(id), getPluginName(id)]),
    nodeTypes: [participantNodeType(id), contributionNodeType(id)],
    edgeTypes: [participatedInEdgeType(id)],
    userTypes: [participantNodeType(id)],
  });
}
