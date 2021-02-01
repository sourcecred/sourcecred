// @flow

import {type NodeAddressT} from "../../graph";
import {nodeWeightEvaluator} from "../../algorithm/weightEvaluator";
import {orElse as either} from "../../../util/null";
import {
  type NodeWeightsT,
  type NodeOperator,
  type NodeWeight,
  empty,
  copy,
  merge,
} from "./nodeWeightsT";

/**
 * EdgeWeightsI is an interface that EdgeWeightsT data
 * gets lifted into that provides helper functions.
 */
export type NodeWeightsI = {|
  eject: () => NodeWeightsT,
  getNodeWeight: (NodeAddressT) => NodeWeight,
  setNodeWeight: (NodeAddressT, NodeWeight) => NodeWeightsI,
  merge: (
    nws: $ReadOnlyArray<NodeWeightsI>,
    nodeResolver?: NodeOperator
  ) => NodeWeightsI,
  copy: () => NodeWeightsI,
|};

/**
 * NodeWeights lifts NodeWeightsT into a context that
 * lazily handles the creation of a NodeWeightEvaluator,
 * which must be constructed to retrieve a node's weight.
 *
 * In addition, this offers a simpler interface to working
 * with weights, as NodeWeightsT transformations are abstracted
 * into functions on this object.
 */
export const NodeWeights = (
  nodeWeightsT: NodeWeightsT = empty()
): NodeWeightsI => {
  let nwe;
  return {
    eject: () => nodeWeightsT,
    getNodeWeight: (address: NodeAddressT): NodeWeight => {
      nwe = either(nwe, nodeWeightEvaluator(nodeWeightsT));
      return nwe(address);
    },
    setNodeWeight: (address: NodeAddressT, weight: NodeWeight) =>
      NodeWeights(nodeWeightsT.set(address, weight)),
    merge: (nws: $ReadOnlyArray<NodeWeightsI>, nodeResolver?: NodeOperator) =>
      NodeWeights(
        merge([nodeWeightsT, ...nws.map((nw) => nw.eject())], nodeResolver)
      ),
    copy: () => NodeWeights(copy(nodeWeightsT)),
  };
};
