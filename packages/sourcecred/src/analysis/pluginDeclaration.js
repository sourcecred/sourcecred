// @flow

import {type NodeAddressT, type EdgeAddressT} from "../core/graph";
import type {EdgeType, NodeType, NodeAndEdgeTypes} from "./types";
import * as Weights from "../core/weights";
import {type WeightsT} from "../core/weights";
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

export function toJSON(dec: PluginDeclaration): PluginDeclarationJSON {
  return toCompat(COMPAT_INFO, dec);
}

export function fromJSON(json: PluginDeclarationJSON): PluginDeclaration {
  return fromCompat(COMPAT_INFO, json);
}

export type PluginDeclarationJSON = Compatible<PluginDeclaration>;

export function combineTypes(
  decs: $ReadOnlyArray<PluginDeclaration>
): NodeAndEdgeTypes {
  const nodeTypes = [].concat(...decs.map((x) => x.nodeTypes));
  const edgeTypes = [].concat(...decs.map((x) => x.edgeTypes));
  return {nodeTypes, edgeTypes};
}

export function weightsForDeclaration(dec: PluginDeclaration): WeightsT {
  const weights = Weights.empty();
  const {nodeTypes, edgeTypes} = dec;
  for (const {prefix, defaultWeight} of nodeTypes) {
    weights.nodeWeights.set(prefix, defaultWeight);
  }
  for (const {prefix, defaultWeight} of edgeTypes) {
    weights.edgeWeights.set(prefix, defaultWeight);
  }
  return weights;
}
