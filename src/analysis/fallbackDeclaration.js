// @flow

import {NodeAddress, EdgeAddress} from "../core/graph";

import type {PluginDeclaration} from "./pluginDeclaration";

import type {EdgeType, NodeType} from "./types";

export const FALLBACK_NAME = "FALLBACK_ADAPTER";

export const fallbackNodeType: NodeType = Object.freeze({
  name: "node",
  pluralName: "nodes",
  prefix: NodeAddress.empty,
  defaultWeight: 1,
  description:
    "The fallback NodeType for nodes which don't have any other type",
});

export const fallbackEdgeType: EdgeType = Object.freeze({
  forwardName: "points to",
  backwardName: "is pointed to by",
  defaultForwardWeight: 1,
  defaultBackwardWeight: 1,
  prefix: EdgeAddress.empty,
  description:
    "The fallback EdgeType for edges which don't have any other type",
});

export const fallbackDeclaration: PluginDeclaration = Object.freeze({
  name: FALLBACK_NAME,
  nodePrefix: NodeAddress.empty,
  edgePrefix: EdgeAddress.empty,
  nodeTypes: Object.freeze([fallbackNodeType]),
  edgeTypes: Object.freeze([fallbackEdgeType]),
});
