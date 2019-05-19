// @flow

import {NodeAddress, EdgeAddress} from "../core/graph";

import type {EdgeType, NodeType} from "./types";

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
  defaultWeight: {forwards: 1, backwards: 1},
  prefix: EdgeAddress.empty,
  description:
    "The fallback EdgeType for edges which don't have any other type",
});
