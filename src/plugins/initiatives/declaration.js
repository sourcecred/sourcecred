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
    "An initiative supernode, describing a scoped improvement to a project from proposal to completion.",
});

/*
	Note on the forward and backward naming convention.
	It follows the core/graph.js documentation to use
	a <subject> <verb> <object> format to figure out
	the directionality.
*/

/**
 * An initiative (src) DEPENDS ON (verb) a dependency (dst).
 * Forward: depending on something shows the value of the dependency.
 * Backward: having a dependency does not endorse the iniative, but does flow
 * some cred to incentivize reuse and attribution.
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
 * Forward: referencing from an initiative shows the value of the reference.
 * But we assume a reference likely needs some refinement to be used by the initiative,
 * so it flows less cred than to a dependency.
 * Backward: having reference material does not endorse the iniative, but does flow
 * some cred to incentivize using existing research and attribution.
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
 * Forward: a contribution towards the initiative is also an endorsement of the
 * value of that initiative.
 * Backward: an initiative in large part consists of it's contributions, so the
 * value of an initiative caries over to it's contributions.
 */
export const contributesToEdgeType: EdgeType = deepFreeze({
  forwardName: "contributes to",
  backwardName: "is contributed to by",
  prefix: EdgeAddress.append(edgePrefix, "contributesTo"),
  defaultWeight: {forwards: 1, backwards: 1},
  description: "Connects an initiative to it's contributions.",
});

/**
 * A user (src) CHAMPIONS (verb) an initiative (dst).
 * Meaning forward is the user claiming and committing they will champion an
 * initiative. And backward is the return of cred based on the completion and
 * succesful championing of the ininiative.
 *
 * Forward: a user championing an iniative is also an endorsement of the value
 * of that initiative.
 * Backward: an initiative likely received a lot of ongoing support from it's
 * champion. We're assuming this is more support than individual contributions.
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
    dependsOnEdgeType,
    referencesEdgeType,
    contributesToEdgeType,
    championsEdgeType,
  ],
  userTypes: [],
});
