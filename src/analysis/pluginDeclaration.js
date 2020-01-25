// @flow

import {type NodeAddressT, type EdgeAddressT} from "../core/graph";
import type {EdgeType, NodeType, NodeAndEdgeTypes} from "./types";
import * as Weights from "../core/weights";
import {type Weights as WeightsT} from "../core/weights";

// TODO(@decentralion): Maybe merge this file with analysis/types

export type PluginDeclaration = {|
  +name: string,
  +nodePrefix: NodeAddressT,
  +edgePrefix: EdgeAddressT,
  +nodeTypes: $ReadOnlyArray<NodeType>,
  +edgeTypes: $ReadOnlyArray<EdgeType>,
  // Which node types represent user identities.
  // Important for computing score and for display in the frontend.
  // It's expected that the userTypes will also be included in the array of
  // nodeTypes.
  +userTypes: $ReadOnlyArray<NodeType>,
|};

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
