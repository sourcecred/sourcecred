// @flow

import deepEqual from "lodash.isequal";
import {
  type NodeAddressT,
  type EdgeAddressT,
  NodeAddress,
  EdgeAddress,
} from "../graph";
import * as C from "../../util/combo";
import {toCompat, type Compatible, compatibleParser} from "../../util/compat";
import * as MapUtil from "../../util/map";
import {
  type NodeWeight,
  type NodeOperator,
  type NodeWeightsT,
  empty as emptyNodeWeightsT,
  copy as copyNodeWeightsT,
} from "./nodeWeights";
import {
  type EdgeWeight,
  type EdgeOperator,
  type EdgeWeightsT,
  empty as emptyEdgeWeightsT,
  copy as copyEdgeWeightsT,
} from "./edgeWeights";

export type WeightsTResolvers = {|
  +nodeResolver: NodeOperator,
  +edgeResolver: EdgeOperator,
|};

/**
 * Represents the weights for nodes and edges.
 *
 * The weights are stored by address prefix, i.e. multiple weights may apply
 * to a given node or edge.
 */
export type WeightsT = {|
  nodeWeightsT: NodeWeightsT,
  // Map from an edge prefix or address to a weight
  edgeWeightsT: EdgeWeightsT,
|};

/**
 * Transform NodeWeightsT and EdgeWeightsT into WeightsT.
 */
export function toWeightsT(
  nodeWeightsT: NodeWeightsT,
  edgeWeightsT: EdgeWeightsT
): WeightsT {
  return {
    nodeWeightsT,
    edgeWeightsT,
  };
}

/**
 * Creates new, empty weights.
 */
export function empty(): WeightsT {
  return {
    nodeWeightsT: emptyNodeWeightsT(),
    edgeWeightsT: emptyEdgeWeightsT(),
  };
}

export function copy(w: WeightsT): WeightsT {
  return {
    nodeWeightsT: copyNodeWeightsT(w.nodeWeightsT),
    edgeWeightsT: copyEdgeWeightsT(w.edgeWeightsT),
  };
}

/** Merge multiple Weights together.
 *
 * The resultant Weights will have every weight specified by each of the input
 * weights.
 *
 * When there are overlaps (i.e. the same address is present in two or more of
 * the Weights), then the appropriate resolver will be invoked to resolve the
 * conflict. The resolver takes two weights and combines them to return a new
 * weight.
 *
 * When no resolvers are explicitly provided, merge defaults to
 * conservative "error on conflict" resolvers.
 */
export function merge(
  ws: $ReadOnlyArray<WeightsT>,
  resolvers: ?WeightsTResolvers
): WeightsT {
  if (resolvers == null) {
    const nodeResolver = (_unused_a, _unused_b) => {
      throw new Error(
        "node weight conflict detected, but no resolver specified"
      );
    };
    const edgeResolver = (_unused_a, _unused_b) => {
      throw new Error(
        "edge weight conflict detected, but no resolver specified"
      );
    };
    resolvers = {nodeResolver, edgeResolver};
  }
  const weights: WeightsT = empty();
  const {nodeWeightsT, edgeWeightsT} = weights;
  const {nodeResolver, edgeResolver} = resolvers;
  for (const w of ws) {
    for (const [addr, val] of w.nodeWeightsT.entries()) {
      const existing = nodeWeightsT.get(addr);
      if (existing == null) {
        nodeWeightsT.set(addr, val);
      } else {
        try {
          nodeWeightsT.set(addr, nodeResolver(existing, val));
        } catch (e) {
          throw new Error(`${e} when resolving ${NodeAddress.toString(addr)}`);
        }
      }
    }
    for (const [addr, val] of w.edgeWeightsT.entries()) {
      const existing = edgeWeightsT.get(addr);
      if (existing == null) {
        edgeWeightsT.set(addr, val);
      } else {
        try {
          edgeWeightsT.set(addr, edgeResolver(existing, val));
        } catch (e) {
          throw new Error(
            `Error ${e} when resolving ${EdgeAddress.toString(addr)}`
          );
        }
      }
    }
  }
  return weights;
}

export type SerializedWeights_0_2_0 = {|
  +nodeWeightsT: {[NodeAddressT]: NodeWeight},
  +edgeWeightsT: {[EdgeAddressT]: EdgeWeight},
|};

function serialize_0_2_0(weights: WeightsT): SerializedWeights_0_2_0 {
  return {
    nodeWeightsT: MapUtil.toObject(weights.nodeWeightsT),
    edgeWeightsT: MapUtil.toObject(weights.edgeWeightsT),
  };
}

function deserialize_0_2_0(weights: SerializedWeights_0_2_0): WeightsT {
  return {
    nodeWeightsT: MapUtil.fromObject(weights.nodeWeightsT),
    edgeWeightsT: MapUtil.fromObject(weights.edgeWeightsT),
  };
}

const Parse_0_2_0: C.Parser<SerializedWeights_0_2_0> = (() => {
  const parseEdgeWeight = C.object({forwards: C.number, backwards: C.number});
  return C.object({
    nodeWeightsT: C.dict(C.number, NodeAddress.parser),
    edgeWeightsT: C.dict(parseEdgeWeight, EdgeAddress.parser),
  });
})();

const COMPAT_INFO = {type: "sourcecred/weights", version: "0.2.0"};

export const parser: C.Parser<WeightsT> = compatibleParser(COMPAT_INFO.type, {
  "0.2.0": C.fmap(Parse_0_2_0, deserialize_0_2_0),
});

export type WeightsJSON_0_2_0 = Compatible<SerializedWeights_0_2_0>;
export type WeightsJSON = WeightsJSON_0_2_0;

export function toJSON(weights: WeightsT): WeightsJSON {
  return toCompat(COMPAT_INFO, serialize_0_2_0(weights));
}

export function fromJSON(json: WeightsJSON): WeightsT {
  return parser.parseOrThrow(json);
}

export type NodeWeightDiff = {|
  +address: NodeAddressT,
  +first: ?NodeWeight,
  +second: ?NodeWeight,
|};

export type EdgeWeightDiff = {|
  +address: EdgeAddressT,
  +first: ?EdgeWeight,
  +second: ?EdgeWeight,
|};

export type WeightsComparison = {|
  +weightsAreEqual: boolean,
  +nodeWeightDiffs: $ReadOnlyArray<NodeWeightDiff>,
  +edgeWeightDiffs: $ReadOnlyArray<EdgeWeightDiff>,
|};

export function compareWeightsT(
  firstWeights: WeightsT,
  secondWeights: WeightsT
): WeightsComparison {
  const nodeWeightDiffs = [];
  const edgeWeightDiffs = [];

  const nodeAddresses = new Set([
    ...firstWeights.nodeWeightsT.keys(),
    ...secondWeights.nodeWeightsT.keys(),
  ]);
  for (const address of nodeAddresses) {
    const first = firstWeights.nodeWeightsT.get(address);
    const second = secondWeights.nodeWeightsT.get(address);
    if (!deepEqual(first, second)) {
      nodeWeightDiffs.push({
        address,
        first,
        second,
      });
    }
  }
  const edgeAddresses = new Set([
    ...firstWeights.edgeWeightsT.keys(),
    ...secondWeights.edgeWeightsT.keys(),
  ]);
  for (const address of edgeAddresses) {
    const first = firstWeights.edgeWeightsT.get(address);
    const second = secondWeights.edgeWeightsT.get(address);
    if (!deepEqual(first, second)) {
      edgeWeightDiffs.push({
        address,
        first,
        second,
      });
    }
  }
  const weightsAreEqual =
    nodeWeightDiffs.length === 0 && edgeWeightDiffs.length === 0;

  return {
    weightsAreEqual,
    nodeWeightDiffs,
    edgeWeightDiffs,
  };
}
