// @flow

import {EdgeAddress, NodeAddress} from "../../core/graph";

import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import type {NodeType} from "../../analysis/types";

export type OdysseyNodeTypeIdentifier =
  | "ARTIFACT"
  | "CONTRIBUTION"
  | "VALUE"
  | "PERSON";

export type OdysseyEdgeTypeIdentifier = "DEPENDS_ON";

export function isOdysseyNodeTypeIdentifier(
  n: OdysseyNodeTypeIdentifier
): boolean {
  return ["ARTIFACT", "CONTRIBUTION", "VALUE", "PERSON"].indexOf(n) !== -1;
}

export const NODE_PREFIX = NodeAddress.fromParts(["sourcecred", "odyssey"]);

export function isOdysseyEdgeTypeIdentifier(x: string): boolean {
  return x === "DEPENDS_ON";
}
export const EDGE_PREFIX = EdgeAddress.fromParts(["sourcecred", "odyssey"]);

const artifactNodeType: NodeType = Object.freeze({
  name: "Artifact",
  pluralName: "Artifacts",
  prefix: NodeAddress.append(NODE_PREFIX, "ARTIFACT"),
  defaultWeight: 2,
  description:
    "Represents a durably valuable piece of a project, e.g. a major subcomponent.",
});

const contributionNodeType: NodeType = Object.freeze({
  name: "Contribution",
  pluralName: "Contributions",
  prefix: NodeAddress.append(NODE_PREFIX, "CONTRIBUTION"),
  defaultWeight: 1,
  description:
    "Represents any specific work or labor that went into a project.",
});

const valueNodeType: NodeType = Object.freeze({
  name: "Value",
  pluralName: "Values",
  prefix: NodeAddress.append(NODE_PREFIX, "VALUE"),
  defaultWeight: 4,
  description: "Represents a high-level value of the project.",
});

const personNodeType: NodeType = Object.freeze({
  name: "Person",
  pluralName: "People",
  prefix: NodeAddress.append(NODE_PREFIX, "PERSON"),
  defaultWeight: 1,
  description: "Represents an individual contributor.",
});

const dependsOnEdgeType = Object.freeze({
  forwardName: "depends on",
  backwardName: "is depended on by",
  prefix: EdgeAddress.append(EDGE_PREFIX, "DEPENDS_ON"),
  defaultForwardWeight: 1,
  defaultBackwardWeight: 0,
  description: "Generic edge for flowing credit in the Odyssey plugin",
});

export const declaration: PluginDeclaration = Object.freeze({
  name: "Odyssey",
  nodePrefix: NODE_PREFIX,
  edgePrefix: EDGE_PREFIX,
  nodeTypes: [
    contributionNodeType,
    valueNodeType,
    personNodeType,
    artifactNodeType,
  ],
  edgeTypes: [dependsOnEdgeType],
});
