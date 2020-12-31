// @flow

import {type EdgeAddressT} from "../../graph";
import {edgeWeightEvaluator} from "../../algorithm/weightEvaluator";
import {orElse as either} from "../../../util/null";
import {
  type EdgeWeightsT,
  type EdgeOperator,
  type EdgeWeight,
  empty,
  copy,
  merge,
} from "./edgeWeightsT";

/**
 * EdgeWeightsI is an interface that EdgeWeightsT data
 * gets lifted into that provides helper functions.
 */
export type EdgeWeightsI = {|
  eject: () => EdgeWeightsT,
  getEdgeWeight: (EdgeAddressT) => EdgeWeight,
  setEdgeWeight: (EdgeAddressT, EdgeWeight) => EdgeWeightsI,
  merge: (
    ws: $ReadOnlyArray<EdgeWeightsI>,
    edgeResolver?: EdgeOperator
  ) => EdgeWeightsI,
  copy: () => EdgeWeightsI,
|};

/**
 * EdgeWeights lifts EdgeWeightsT into a context that
 * lazily handles the creation of a EdgeWeightEvaluator,
 * which must be constructed to retrieve a node's weight.
 *
 * In addition, this offers a simpler interface to working
 * with weights, as EdgeWeightsT transformations are abstracted
 * into functions on this object.
 */
export const EdgeWeights = (
  edgeWeightsT: EdgeWeightsT = empty()
): EdgeWeightsI => {
  let ewe;
  return {
    eject: () => edgeWeightsT,
    getEdgeWeight: (address: EdgeAddressT): EdgeWeight => {
      ewe = either(ewe, edgeWeightEvaluator(edgeWeightsT));
      return ewe(address);
    },
    setEdgeWeight: (address: EdgeAddressT, weight: EdgeWeight) =>
      EdgeWeights(edgeWeightsT.set(address, weight)),
    merge: (ews: $ReadOnlyArray<EdgeWeightsI>, edgeResolver?: EdgeOperator) =>
      EdgeWeights(
        merge([edgeWeightsT, ...ews.map((ew) => ew.eject())], edgeResolver)
      ),
    copy: () => EdgeWeights(copy(edgeWeightsT)),
  };
};
