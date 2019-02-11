// @flow

import {NodeAddress, EdgeAddress} from "../../core/graph";

import type {PluginDeclaration} from "../../analysis/pluginDeclaration";

import type {EdgeType, NodeType} from "../../analysis/types";

export const inserterNodeType: NodeType = Object.freeze({
  name: "inserter",
  pluralName: "inserters",
  prefix: NodeAddress.fromParts(["factorio", "inserter"]),
  defaultWeight: 1,
  description: "Nodes for Factorio inserter objects in demo plugin",
});

export const machineNodeType: NodeType = Object.freeze({
  name: "machine",
  pluralName: "machines",
  prefix: NodeAddress.fromParts(["factorio", "machine"]),
  defaultWeight: 2,
  description: "Nodes for Factorio machine objects in demo plugin",
});

export const assemblesEdgeType: EdgeType = Object.freeze({
  forwardName: "assembles",
  defaultForwardWeight: 2,
  backwardName: "is assembled by",
  defaultBackwardWeight: 2 ** -2,
  prefix: EdgeAddress.fromParts(["factorio", "assembles"]),
  description: "Connects assembly machines to products they assemble.",
});

export const transportsEdgeType: EdgeType = Object.freeze({
  forwardName: "transports",
  defaultForwardWeight: 1,
  backwardName: "is transported by",
  defaultBackwardWeight: 2 ** -1,
  prefix: EdgeAddress.fromParts(["factorio", "transports"]),
  description: "Connects transporter belts to objects they transport.",
});

export const declaration: PluginDeclaration = Object.freeze({
  name: "Factorio demo adapter",
  nodePrefix: NodeAddress.fromParts(["factorio"]),
  nodeTypes: Object.freeze([inserterNodeType, machineNodeType]),
  edgePrefix: EdgeAddress.fromParts(["factorio"]),
  edgeTypes: Object.freeze([assemblesEdgeType, transportsEdgeType]),
});
