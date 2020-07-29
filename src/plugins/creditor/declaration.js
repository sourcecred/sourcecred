// @flow

import deepFreeze from "deep-freeze";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import type {NodeType, EdgeType} from "../../analysis/types";
import {NodeAddress, EdgeAddress} from "../../core/graph";

export const nodePrefix = NodeAddress.fromParts(["sourcecred", "creditor"]);
export const edgePrefix = EdgeAddress.fromParts(["sourcecred", "creditor"]);

export const CreditorEntryType: NodeType = deepFreeze({
  name: "CredNode",
  pluralName: "CredNodes",
  prefix: NodeAddress.append(nodePrefix, "credNode"),
  defaultWeight: 0,
  description:
    "An creditor node, describing a scoped improvement to a project from proposal to completion. \
    Creditor nodes can be nested  arbitrarily (but non-circularly) to represent complet projects and scopes",
});

/*
  Note on the forward and backward naming convention.
  It follows the core/graph.js documentation to use
  a <subject> <verb> <object> format to figure out
  the directionality.
*/

/**
 * A contributor (src) CONTRIBUTES TO (verb) an Creditor node (dst).
 * Forward: a contributor towards the entry node has a small endorsement of that
 * contribution.
 * Backward: flows the value of the contribution to the contributors.
 */
export const CreditorEdgeType: EdgeType = deepFreeze({
  forwardName: "contributes to entry",
  backwardName: "entry is contributed to by",
  prefix: EdgeAddress.append(edgePrefix, "contributesToEntry"),
  defaultWeight: {forwards: 1 / 16, backwards: 1},
  description: "Connects a contributor to an entry node.",
});

export const declaration: PluginDeclaration = deepFreeze({
  name: "Creditor",
  nodePrefix,
  edgePrefix,
  nodeTypes: [CreditorEntryType],
  edgeTypes: [CreditorEdgeType],
  userTypes: [],
});
