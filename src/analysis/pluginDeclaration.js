// @flow

import {type NodeAddressT, type EdgeAddressT} from "../core/graph";
import type {EdgeType, NodeType, NodeAndEdgeTypes} from "./types";
import * as WeightsT from "../core/weights/weightsT";
import {toCompat, fromCompat, type Compatible} from "../util/compat";

const COMPAT_INFO = {type: "sourcecred/pluginDeclarations", version: "0.1.0"};

// TODO(@decentralion): Maybe merge this file with analysis/types

export type PluginDeclaration = {|
  +name: string,
  +nodePrefix: NodeAddressT,
  +edgePrefix: EdgeAddressT,
  +nodeTypes: $ReadOnlyArray<NodeType>,
  +edgeTypes: $ReadOnlyArray<EdgeType>,
  // Which node types represent user identities.
  // This is vestigial, as now all users are automatically made into Identities.
  // It will be removed in the future.
  +userTypes: $ReadOnlyArray<NodeType>,
|};

export type PluginDeclarations = $ReadOnlyArray<PluginDeclaration>;

export function toJSON(decs: PluginDeclarations): PluginDeclarationsJSON {
  return toCompat(COMPAT_INFO, decs);
}

export function fromJSON(json: PluginDeclarationsJSON): PluginDeclarations {
  return fromCompat(COMPAT_INFO, json);
}

export type PluginDeclarationsJSON = Compatible<PluginDeclarations>;

export function combineTypes(
  decs: $ReadOnlyArray<PluginDeclaration>
): NodeAndEdgeTypes {
  const nodeTypes = [].concat(...decs.map((x) => x.nodeTypes));
  const edgeTypes = [].concat(...decs.map((x) => x.edgeTypes));
  return {nodeTypes, edgeTypes};
}

export function weightsForDeclaration(
  dec: PluginDeclaration
): WeightsT.WeightsT {
  const weights = WeightsT.empty();
  const {nodeTypes, edgeTypes} = dec;
  for (const {prefix, defaultWeight} of nodeTypes) {
    weights.nodeWeightsT.set(prefix, defaultWeight);
  }
  for (const {prefix, defaultWeight} of edgeTypes) {
    weights.edgeWeightsT.set(prefix, defaultWeight);
  }
  return weights;
}
