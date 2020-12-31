// @flow

import {type NodeAddressT, type EdgeAddressT} from "../graph";
import {
  type NodeWeight,
  type NodeWeightsI,
  type NodeOperator,
  type NodeWeightsT,
  NodeWeights,
  empty as emptyNodeWeightsT,
} from "./nodeWeights";
import {
  type EdgeWeight,
  type EdgeWeightsI,
  type EdgeOperator,
  type EdgeWeightsT,
  EdgeWeights,
  empty as emptyEdgeWeightsT,
} from "./edgeWeights";
import {
  type WeightsT,
  type WeightsJSON,
  type WeightsTResolvers,
  compareWeightsT,
  toJSON,
  fromJSON as JsonToWeightsT,
  toWeightsT,
} from "./weightsT";

/**
 * WeightsI is an interface that WeightsT data
 * gets lifted into that provides helper functions.
 */
export type WeightsI = {
  eject: () => WeightsT,
  nodeWeightsT: () => NodeWeightsT,
  edgeWeightsT: () => EdgeWeightsT,
  getNodeWeight: (NodeAddressT) => NodeWeight,
  getEdgeWeight: (EdgeAddressT) => EdgeWeight,
  setNodeWeight: (NodeAddressT, NodeWeight) => WeightsI,
  setEdgeWeight: (EdgeAddressT, EdgeWeight) => WeightsI,
  merge: (
    ws: $ReadOnlyArray<WeightsI>,
    resolvers?: WeightsTResolvers
  ) => WeightsI,
  copy: () => WeightsI,
  toJSON: () => WeightsJSON,
};

/**
 * Weights composes NodeWeightsI and EdgeWeightsI into a higher
 * order object, allowing us to interface with the underlying
 * Node/EdgeWeights while holding the aggregated Weights here.
 */
export const Weights = (
  nodeWeights: NodeWeightsI = NodeWeights(),
  edgeWeights: EdgeWeightsI = EdgeWeights()
): WeightsI => {
  const {getNodeWeight, setNodeWeight, eject: nodeWeightsT} = nodeWeights;
  const {getEdgeWeight, setEdgeWeight, eject: edgeWeightsT} = edgeWeights;
  const eject = () => toWeightsT(nodeWeights.eject(), edgeWeights.eject());
  return {
    eject,
    nodeWeightsT,
    edgeWeightsT,
    getNodeWeight,
    getEdgeWeight,
    setNodeWeight: (address: NodeAddressT, weight: NodeWeight) =>
      Weights(setNodeWeight(address, weight), edgeWeights),
    setEdgeWeight: (address: EdgeAddressT, weight: EdgeWeight) =>
      Weights(nodeWeights, setEdgeWeight(address, weight)),
    merge: (
      ws: $ReadOnlyArray<WeightsI>,
      resolvers?: {|
        +nodeResolver: NodeOperator,
        +edgeResolver: EdgeOperator,
      |}
    ) => merge([Weights(nodeWeights, edgeWeights), ...ws], resolvers),
    copy: () => Weights(nodeWeights.copy(), edgeWeights.copy()),
    toJSON: () => toJSON(eject()),
  };
};

/**
 * Lifts Node/EdgeWeightsT instead of Node/EdgeWeights by abstracting
 * the intermediate transformatino to Node/EdgeWeights.
 */
export function weightsTToWeights(
  nodeWeightsT: NodeWeightsT = emptyNodeWeightsT(),
  edgeWeightsT: EdgeWeightsT = emptyEdgeWeightsT()
): WeightsI {
  return Weights(NodeWeights(nodeWeightsT), EdgeWeights(edgeWeightsT));
}

/**
 * Merge composes the merge methods on NodeWeights and EdgeWeights
 * into a higher order Weights level merge.
 */
function merge(
  ws: $ReadOnlyArray<WeightsI>,
  resolvers?: WeightsTResolvers
): WeightsI {
  const nodeResolver = resolvers ? resolvers.nodeResolver : undefined;
  const edgeResolver = resolvers ? resolvers.edgeResolver : undefined;
  const nodeWeightsT = NodeWeights();
  const edgeWeightsT = EdgeWeights();
  const mergedNodeWeights = nodeWeightsT.merge(
    ws.map((w) => NodeWeights(w.nodeWeightsT())),
    nodeResolver
  );
  const mergedEdgeWeights = edgeWeightsT.merge(
    ws.map((w) => EdgeWeights(w.edgeWeightsT())),
    edgeResolver
  );
  return Weights(mergedNodeWeights, mergedEdgeWeights);
}

export function fromJSON(json: WeightsJSON): WeightsI {
  const {nodeWeightsT, edgeWeightsT} = JsonToWeightsT(json);
  return weightsTToWeights(nodeWeightsT, edgeWeightsT);
}

/**
 * Predicate determines whether two WeightsI's are equivalent
 * checking the following conditions which are not handled by typing:
 * - Node/Edge weights are equivalent
 * - Functions match
 */
export function areEqual(W1: WeightsI, W2: WeightsI): boolean {
  const {weightsAreEqual} = compareWeightsT(W1.eject(), W2.eject());
  return (
    weightsAreEqual &&
    W1.copy.toString() === W2.copy.toString() &&
    W1.toJSON.toString() === W2.toJSON.toString() &&
    W1.merge.toString() === W2.merge.toString() &&
    W1.getNodeWeight.toString() === W2.getNodeWeight.toString() &&
    W1.getEdgeWeight.toString() === W2.getEdgeWeight.toString() &&
    W1.setNodeWeight.toString() === W2.setNodeWeight.toString() &&
    W1.setEdgeWeight.toString() === W2.setEdgeWeight.toString()
  );
}
