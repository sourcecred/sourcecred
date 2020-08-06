// @flow

import deepFreeze from "deep-freeze";

import {NodeAddress, EdgeAddress} from "../../core/graph";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import type {EdgeType, NodeType} from "../../analysis/types";
import * as N from "../../util/numerics";

export const inserterNodeType: NodeType = deepFreeze({
  name: "inserter",
  pluralName: "inserters",
  prefix: NodeAddress.fromParts(["factorio", "inserter"]),
  defaultWeight: N.finiteNonnegative(1),
  description: "Nodes for Factorio inserter objects in demo plugin",
});

export const machineNodeType: NodeType = deepFreeze({
  name: "machine",
  pluralName: "machines",
  prefix: NodeAddress.fromParts(["factorio", "machine"]),
  defaultWeight: N.finiteNonnegative(2),
  description: "Nodes for Factorio machine objects in demo plugin",
});

export const assemblesEdgeType: EdgeType = deepFreeze({
  forwardName: "assembles",
  backwardName: "is assembled by",
  defaultWeight: {
    forwards: N.finiteNonnegative(2),
    backwards: N.finiteNonnegative(2 ** -2),
  },
  prefix: EdgeAddress.fromParts(["factorio", "assembles"]),
  description: "Connects assembly machines to products they assemble.",
});

export const transportsEdgeType: EdgeType = deepFreeze({
  forwardName: "transports",
  backwardName: "is transported by",
  defaultWeight: {
    forwards: N.finiteNonnegative(2),
    backwards: N.finiteNonnegative(2 ** -1),
  },
  prefix: EdgeAddress.fromParts(["factorio", "transports"]),
  description: "Connects transporter belts to objects they transport.",
});

export const declaration: PluginDeclaration = deepFreeze({
  name: "Factorio demo adapter",
  nodePrefix: NodeAddress.fromParts(["factorio"]),
  nodeTypes: [inserterNodeType, machineNodeType],
  edgePrefix: EdgeAddress.fromParts(["factorio"]),
  edgeTypes: [assemblesEdgeType, transportsEdgeType],
  userTypes: [],
});
