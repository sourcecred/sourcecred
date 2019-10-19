// @flow

import deepFreeze from "deep-freeze";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import type {NodeType, EdgeType} from "../../analysis/types";
import {NodeAddress, EdgeAddress} from "../../core/graph";

export const nodePrefix = NodeAddress.fromParts(["sourcecred", "initiatives"]);
export const edgePrefix = EdgeAddress.fromParts(["sourcecred", "initiatives"]);

export const initiativeNodeType: NodeType = deepFreeze({
  name: "Initiative",
  pluralName: "Initiatives",
  prefix: NodeAddress.append(nodePrefix, "initiative"),
  defaultWeight: 1,
  description:
    "An initiative, formatted as a Discourse wiki topic using a fixed template.",
});

/*
	Note on the forward and backward naming convention.
	It follows the core/graph.js documentation to use
	a <subject> <verb> <object> format to figure out
	the directionality.
*/

/**
 * A Discourse topic (src) TRACKS (verb) an initiative (dst).
 * Forward: separate in terms of cred flow for now
 * Backward: separate in terms of cred flow for now
 */
export const discourseTopicTracksInitiativeEdgeType: EdgeType = deepFreeze({
  forwardName: "tracks",
  backwardName: "is tracked by",
  prefix: EdgeAddress.append(edgePrefix, "discourseTopicTracksInitiative"),
  defaultWeight: {forwards: 0, backwards: 0},
  description: "Connects an initiative to the Discourse topic that tracks it.",
});

/**
 * An initiative (src) DEPENDS ON (verb) a dependency (dst).
 * Forward: depending on something flows significant cred to the dependency.
 * Backward: having a dependency does not flow much cred to the iniative,
 * though does flow some to incentivize reuse and attribution.
 */
export const dependsOnEdgeType: EdgeType = deepFreeze({
  forwardName: "depends on",
  backwardName: "is a dependency for",
  prefix: EdgeAddress.append(edgePrefix, "dependsOn"),
  defaultWeight: {forwards: 1, backwards: 1 / 16},
  description: "Connects an initiative to it's dependencies.",
});

/**
 * An initiative (src) REFERENCES (verb) a reference (dst).
 * Forward: reference for an initiative flows medium cred to the reference.
 * Backward: having reference material does not flow much cred to the iniative,
 * though does flow some to incentivize using existing research and attribution.
 */
export const referencesEdgeType: EdgeType = deepFreeze({
  forwardName: "references",
  backwardName: "is referenced for",
  prefix: EdgeAddress.append(edgePrefix, "references"),
  defaultWeight: {forwards: 1 / 2, backwards: 1 / 16},
  description: "Connects an initiative to it's references.",
});

/**
 * A contribution (src) CONTRIBUTES TO (verb) an initiative (dst).
 * Forward: a contribution flows a medium amount of cred to the initiative.
 * Backward: an initiative flows significant cred to it's contributions.
 */
export const contributesToEdgeType: EdgeType = deepFreeze({
  forwardName: "contributes to",
  backwardName: "is contributed to by",
  prefix: EdgeAddress.append(edgePrefix, "contributesTo"),
  defaultWeight: {forwards: 1 / 4, backwards: 1},
  description: "Connects an initiative to it's contributions.",
});

/**
 * A user (src) CHAMPIONS (verb) an initiative (dst).
 * Meaning forward is the user claiming and committing they will champion an initiative.
 * and backward is the return of cred based on the completion and succesful championing of the ininiative.
 * Forward and backward weights depend on the status of the iniative and success of the champion.
 * The weights represent a successful champion for a completed iniative.
 *
 * Forward: having a champion flows significant cred to the iniative.
 * Backward: being a successful champion for an iniative flows massive cred to the user.
 */
export const championsEdgeType: EdgeType = deepFreeze({
  forwardName: "champions",
  backwardName: "is championed by",
  prefix: EdgeAddress.append(edgePrefix, "champions"),
  defaultWeight: {forwards: 1, backwards: 4},
  description: "Connects an initiative to users who champion it.",
});

export const declaration: PluginDeclaration = deepFreeze({
  name: "Initiatives",
  nodePrefix,
  edgePrefix,
  nodeTypes: [initiativeNodeType],
  edgeTypes: [
    discourseTopicTracksInitiativeEdgeType,
    dependsOnEdgeType,
    referencesEdgeType,
    contributesToEdgeType,
    championsEdgeType,
  ],
  userTypes: [],
});
