// @flow

import deepEqual from "lodash.isequal";
import * as MapUtil from "../util/map";
import * as C from "../util/combo";
import {
  type NodeAddressT,
  type EdgeAddressT,
  NodeAddress,
  EdgeAddress,
} from "../core/graph";
import {toCompat, type Compatible, compatibleParser} from "../util/compat";

/**
 * Represents the weight for a particular Node (or node address prefix).
 * Weight 1 is the default value and signifies normal importance.
 * Weights are linear, so 2 is twice as important as 1.
 */
export type NodeWeight = number;

export type NodeOperator = (NodeWeight, NodeWeight) => NodeWeight;

/**
 * Represents the forwards and backwards weights for a particular Edge (or
 * edge address prefix).
 * Weight 1 is the default value and signifies normal importance.
 * Weights are linear, so 2 is twice as important as 1.
 */
export type EdgeWeight = {|+forwards: number, +backwards: number|};

export type EdgeOperator = (EdgeWeight, EdgeWeight) => EdgeWeight;

/**
 * Represents the weights for nodes and edges.
 *
 * The weights are stored by address prefix, i.e. multiple weights may apply
 * to a given node or edge.
 */
export type WeightsT = {|
  nodeWeights: Map<NodeAddressT, NodeWeight>,
  // Map from an edge prefix or address to a weight
  edgeWeights: Map<EdgeAddressT, EdgeWeight>,
|};

/**
 * Creates new, empty weights.
 */
export function empty(): WeightsT {
  return {
    nodeWeights: new Map(),
    edgeWeights: new Map(),
  };
}

export function copy(w: WeightsT): WeightsT {
  return {
    nodeWeights: new Map(w.nodeWeights),
    edgeWeights: new Map(w.edgeWeights),
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
  resolvers: ?{|+nodeResolver: NodeOperator, +edgeResolver: EdgeOperator|}
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
  const {nodeWeights, edgeWeights} = weights;
  const {nodeResolver, edgeResolver} = resolvers;
  for (const w of ws) {
    for (const [addr, val] of w.nodeWeights.entries()) {
      const existing = nodeWeights.get(addr);
      if (existing == null) {
        nodeWeights.set(addr, val);
      } else {
        try {
          nodeWeights.set(addr, nodeResolver(existing, val));
        } catch (e) {
          throw new Error(`${e} when resolving ${NodeAddress.toString(addr)}`);
        }
      }
    }
    for (const [addr, val] of w.edgeWeights.entries()) {
      const existing = edgeWeights.get(addr);
      if (existing == null) {
        edgeWeights.set(addr, val);
      } else {
        try {
          edgeWeights.set(addr, edgeResolver(existing, val));
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
  +nodeWeights: {[NodeAddressT]: NodeWeight},
  +edgeWeights: {[EdgeAddressT]: EdgeWeight},
|};

function serialize_0_2_0(weights: WeightsT): SerializedWeights_0_2_0 {
  return {
    nodeWeights: MapUtil.toObject(weights.nodeWeights),
    edgeWeights: MapUtil.toObject(weights.edgeWeights),
  };
}

function deserialize_0_2_0(weights: SerializedWeights_0_2_0): WeightsT {
  return {
    nodeWeights: MapUtil.fromObject(weights.nodeWeights),
    edgeWeights: MapUtil.fromObject(weights.edgeWeights),
  };
}

const Parse_0_2_0: C.Parser<SerializedWeights_0_2_0> = (() => {
  const parseEdgeWeight = C.object({forwards: C.number, backwards: C.number});
  return C.object({
    nodeWeights: C.dict(C.number, NodeAddress.parser),
    edgeWeights: C.dict(parseEdgeWeight, EdgeAddress.parser),
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

export function compareWeights(
  firstWeights: WeightsT,
  secondWeights: WeightsT
): WeightsComparison {
  const nodeWeightDiffs = [];
  const edgeWeightDiffs = [];

  const nodeAddresses = new Set([
    ...firstWeights.nodeWeights.keys(),
    ...secondWeights.nodeWeights.keys(),
  ]);
  for (const address of nodeAddresses) {
    const first = firstWeights.nodeWeights.get(address);
    const second = secondWeights.nodeWeights.get(address);
    if (!deepEqual(first, second)) {
      nodeWeightDiffs.push({
        address,
        first,
        second,
      });
    }
  }
  const edgeAddresses = new Set([
    ...firstWeights.edgeWeights.keys(),
    ...secondWeights.edgeWeights.keys(),
  ]);
  for (const address of edgeAddresses) {
    const first = firstWeights.edgeWeights.get(address);
    const second = secondWeights.edgeWeights.get(address);
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
