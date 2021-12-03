// @flow

import {
  type NodeAddressT,
  type EdgeAddressT,
  NodeAddress,
  EdgeAddress,
} from "../core/graph";
import type {EdgeType, NodeType, NodeAndEdgeTypes} from "./types";
import {nodeTypeParser, edgeTypeParser} from "./types";
import * as Weights from "../core/weights";
import {type WeightsT} from "../core/weights";
import * as C from "../util/combo";

// TODO(@decentralion): Maybe merge this file with analysis/types

export type PluginDeclaration = {|
  +name: string,
  +nodePrefix: NodeAddressT,
  +edgePrefix: EdgeAddressT,
  +nodeTypes: $ReadOnlyArray<NodeType>,
  +edgeTypes: $ReadOnlyArray<EdgeType>,
  // Which node types represent user identities.
  // This is used to exclude user node types from the weight configuration UI
  +userTypes: $ReadOnlyArray<NodeType>,
  +keys: KeysDeclaration,
|};

type KeysDeclaration = {|
  operatorKeys: $ReadOnlyArray<string>,
  weightKeys: $ReadOnlyArray<string>,
  shareKeys: $ReadOnlyArray<string>,
|};
const keysParser = C.object({
  operatorKeys: C.array(C.string),
  weightKeys: C.array(C.string),
  shareKeys: C.array(C.string),
});

export const declarationParser: C.Parser<PluginDeclaration> = C.object({
  name: C.string,
  nodePrefix: NodeAddress.parser,
  edgePrefix: EdgeAddress.parser,
  nodeTypes: C.array(nodeTypeParser),
  edgeTypes: C.array(edgeTypeParser),
  userTypes: C.array(nodeTypeParser),
  keys: keysParser,
});

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
