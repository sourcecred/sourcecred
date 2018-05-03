// @flow

import type {Address} from "../../core/address";
import type {Graph} from "../../core/graph";

export const ARTIFACT_PLUGIN_NAME = "sourcecred/artifact-beta";

export const ARTIFACT_NODE_TYPE = "ARTIFACT";
export type ArtifactNodePayload = {|
  +name: string,
  +description: string,
|};

export type NodePayload = ArtifactNodePayload;

export const INCLUDES_EDGE_TYPE = "INCLUDES";
export type IncludesEdgePayload = {|
  +weight: number, // non-negative
|};

export type EdgePayload = IncludesEdgePayload;

const NON_SLUG_CHARACTER: RegExp = /[^a-z]/g;

export function artifactAddress(
  graph: Graph<NodePayload, EdgePayload>,
  repoOwner: string,
  repoName: string,
  artifactName: string
): Address {
  const baseName = artifactName.toLowerCase().replace(NON_SLUG_CHARACTER, "-");
  const baseId = `${repoOwner}/${repoName}/${baseName}`;
  function address(id) {
    return {
      pluginName: ARTIFACT_PLUGIN_NAME,
      id,
      type: ARTIFACT_NODE_TYPE,
    };
  }
  let id = baseId;
  for (let i = 0; graph.node(address(id)) != null; i++) {
    id = baseId + "-" + i;
  }
  return address(id);
}
