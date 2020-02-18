// @flow

import {max, min} from "d3-array";
import {weekIntervals} from "./interval";
import sortedIndex from "lodash.sortedindex";
import {makeAddressModule, type AddressModule} from "./address";
import {
  type NodeAddressT,
  NodeAddress,
  type EdgeAddressT,
  EdgeAddress,
} from "./graph";
import {type WeightedGraph as WeightedGraphT} from "./weightedGraph";
import {type NodeWeight} from "./weights";
import {
  nodeWeightEvaluator,
  edgeWeightEvaluator,
} from "./algorithm/weightEvaluator";
import * as NullUtil from "../util/null";
import * as MapUtil from "../util/map";
import {type SparseMarkovChain} from "./algorithm/markovChain";

export type TimestampMs = number;
export type TransitionProbability = number;

export type MarkovNode = {|
  +address: NodeAddressT,
  +description: string,
  +weight: NodeWeight,
|};
export type MarkovEdge = {|
  // note: primary key is `(address, reversed)`, not just `(address)`
  +address: EdgeAddressT,
  // If this came from an underlying graph edge, have its `src` and
  // `dst` been swapped (in the process of handling the reverse
  // component of a bidirectional edge)?
  +reversed: boolean,
  // source node at markov chain level
  +src: NodeAddressT,
  // destination node at markov chain level
  +dst: NodeAddressT,
  // Pr[X_{n+1} = dst | X_{n} = dst]
  +transitionProbability: TransitionProbability,
|};
export opaque type MarkovEdgeAddressT: string = string;
export const MarkovEdgeAddress: AddressModule<MarkovEdgeAddressT> = (makeAddressModule(
  {
    name: "MarkovEdgeAddress",
    nonce: "ME",
    otherNonces: new Map().set("N", "NodeAddress").set("E", "EdgeAddress"),
  }
): AddressModule<string>);

export type OrderedSparseMarkovChain = {|
  +nodeOrder: $ReadOnlyArray<NodeAddressT>,
  +chain: SparseMarkovChain,
|};

const SEED_ADDRESS = NodeAddress.fromParts(["sourcecred", "core", "SEED"]);
const SEED_DESCRIPTION = "\u{1f331}";

const EPOCH_PREFIX = NodeAddress.fromParts(["sourcecred", "core", "EPOCH"]);

export type EpochNodeAddress = {|
  +type: "EPOCH_NODE",
  +owner: NodeAddressT,
  +epochStart: TimestampMs,
|};

export function epochNodeAddressToRaw(addr: EpochNodeAddress): NodeAddressT {
  return NodeAddress.append(
    EPOCH_PREFIX,
    String(addr.epochStart),
    ...NodeAddress.toParts(addr.owner)
  );
}

export function epochNodeAddressFromRaw(addr: NodeAddressT): EpochNodeAddress {
  if (!NodeAddress.hasPrefix(addr, EPOCH_PREFIX)) {
    throw new Error("not epochNodeAddress");
  }
  const epochPrefixLength = NodeAddress.toParts(EPOCH_PREFIX).length;
  const parts = NodeAddress.toParts(addr);
  const epochStart = +parts[epochPrefixLength];
  const owner = NodeAddress.fromParts(parts.slice(epochPrefixLength + 1));
  return {
    type: "EPOCH_NODE",
    owner,
    epochStart,
  };
}

// STOPSHIP document these parameters
export type FibrationOptions = {|
  +what: $ReadOnlyArray<NodeAddressT>,
  +beta: TransitionProbability,
  +gammaForward: TransitionProbability,
  +gammaBackward: TransitionProbability,
|};
export type SeedOptions = {|
  +alpha: TransitionProbability,
|};

// STOPSHIP use CompatInfo
export type MarkovProcessGraphJSON = {|
  +nodes: {|+[NodeAddressT]: MarkovNode|},
  +edges: {|+[MarkovEdgeAddressT]: MarkovEdge|},
  +scoringAddresses: $ReadOnlyArray<NodeAddressT>,
|};

// properties:
//   - unidirectional multiedge weighted graph
//   - outbound transition probabilities sum to 1 for each node
//       - implicit: every node has at least one out-edge
//   - no dangling edges (in either direction)
export class MarkovProcessGraph {
  _nodes: Map<NodeAddressT, MarkovNode>;
  _edges: Map<MarkovEdgeAddressT, MarkovEdge>;
  _scoringAddresses: Set<NodeAddressT>;

  constructor(
    nodes: Map<NodeAddressT, MarkovNode>,
    edges: Map<MarkovEdgeAddressT, MarkovEdge>,
    scoringAddresses: Set<NodeAddressT>
  ) {
    this._nodes = nodes;
    this._edges = edges;
    this._scoringAddresses = scoringAddresses;
  }

  static new(
    wg: WeightedGraphT,
    fibration: FibrationOptions,
    seed: SeedOptions
  ) {
    const _nodes = new Map();
    const _edges = new Map();
    const _scoringAddresses = new Set();

    const epochTransitionRemainder = (() => {
      const {beta, gammaForward, gammaBackward} = fibration;
      if (beta < 0 || gammaForward < 0 || gammaBackward < 0) {
        throw new Error(
          "Negative transition probability: " +
            [beta, gammaForward, gammaBackward].join(" or ")
        );
      }
      const result = 1 - (beta + gammaForward + gammaBackward);
      if (result < 0) {
        throw new Error(
          "Overlarge transition probability: " +
            (beta + gammaForward + gammaBackward)
        );
      }
      return result;
    })();

    const edgeTimestamps = Array.from(
      wg.graph.edges({showDangling: false})
    ).map((x) => x.timestampMs);
    const start = min(edgeTimestamps);
    const end = max(edgeTimestamps);
    const boundaries = weekIntervals(start, end).map((x) => x.startTimeMs);
    const timeBoundaries = [-Infinity, ...boundaries, Infinity];

    // Build graph
    {
      const addNode = (node: MarkovNode) => {
        if (_nodes.has(node.address)) {
          throw new Error("Node conflict: " + node.address);
        }
        _nodes.set(node.address, node);
      };
      const addEdge = (edge: MarkovEdge) => {
        const mae = MarkovEdgeAddress.fromParts([
          edge.reversed ? "B" /* Backward */ : "F" /* Forward */,
          ...EdgeAddress.toParts(edge.address),
        ]);
        if (_edges.has(mae)) {
          throw new Error("Edge conflict: " + mae);
        }
        _edges.set(mae, edge);
      };

      // Add seed node
      addNode({
        address: SEED_ADDRESS,
        description: SEED_DESCRIPTION,
        weight: 0,
      });

      // Add graph nodes
      const nwe = nodeWeightEvaluator(wg.weights);
      for (const node of wg.graph.nodes()) {
        const weight = nwe(node.address);
        if (weight < 0) {
          throw new Error(">:-(");
        }
        addNode({
          address: node.address,
          description: node.description,
          weight,
        });
      }

      for (const {address} of wg.graph.nodes()) {
        if (
          fibration.what.some((prefix) =>
            NodeAddress.hasPrefix(address, prefix)
          )
        ) {
          _scoringAddresses.add(address);
        }
      }

      // Add epoch nodes, epoch-out edges, and epoch webbing
      for (const scoringAddress of _scoringAddresses) {
        let lastBoundary = null;
        for (const boundary of timeBoundaries) {
          const thisEpoch = epochNodeAddressToRaw({
            type: "EPOCH_NODE",
            owner: scoringAddress,
            epochStart: boundary,
          });
          addNode({
            address: thisEpoch,
            description: "Markdown is the bane of my existence",
            weight: 0,
          });
          addEdge({
            address: EdgeAddress.fromParts([
              "sourcecred",
              "core",
              "fibration",
              "EPOCH_PAYOUT",
              String(boundary),
              ...NodeAddress.toParts(scoringAddress),
            ]),
            reversed: false,
            src: thisEpoch,
            dst: scoringAddress,
            transitionProbability: fibration.beta,
          });
          if (lastBoundary != null) {
            const lastEpoch = epochNodeAddressToRaw({
              type: "EPOCH_NODE",
              owner: scoringAddress,
              epochStart: lastBoundary,
            });
            const webAddress = EdgeAddress.fromParts([
              "sourcecred",
              "core",
              "fibration",
              "EPOCH_WEBBING",
              String(boundary),
              ...NodeAddress.toParts(scoringAddress),
            ]);
            addEdge({
              address: webAddress,
              reversed: false,
              src: lastEpoch,
              dst: thisEpoch,
              transitionProbability: fibration.gammaForward,
            });
            addEdge({
              address: webAddress,
              reversed: true,
              src: thisEpoch,
              dst: lastEpoch,
              transitionProbability: fibration.gammaBackward,
            });
          }
          lastBoundary = boundary;
        }
      }

      {
        // Add seed-in edges
        for (const node of wg.graph.nodes()) {
          addEdge({
            address: EdgeAddress.fromParts([
              "sourcecred",
              "core",
              "SEED_IN",
              ...NodeAddress.toParts(node.address),
            ]),
            reversed: false,
            src: node.address,
            dst: SEED_ADDRESS,
            transitionProbability: seed.alpha,
          });
        }

        // Add seed-out edges
        {
          let totalNodeWeight = 0.0;
          const positiveNodeWeights: Map<NodeAddressT, number> = new Map();
          for (const {address, weight} of _nodes.values()) {
            if (weight > 0) {
              totalNodeWeight += weight;
              positiveNodeWeights.set(address, weight);
            }
          }
          if (!(totalNodeWeight > 0)) {
            throw new Error("giv nodes");
          }
          for (const [address, weight] of positiveNodeWeights) {
            addEdge({
              address: EdgeAddress.fromParts([
                "sourcecred",
                "core",
                "SEED_OUT",
                ...NodeAddress.toParts(address),
              ]),
              reversed: false,
              src: SEED_ADDRESS,
              dst: address,
              transitionProbability: weight / totalNodeWeight,
            });
          }
        }

        // Add graph edges.
        {
          // Find an epoch node, or just the original node if it's not a
          // scoring address.
          const rewriteEpochNode = (
            address: NodeAddressT,
            edgeTimestampMs: number
          ): NodeAddressT => {
            if (!_scoringAddresses.has(address)) {
              return address;
            }
            const epochEndIndex = sortedIndex(timeBoundaries, edgeTimestampMs);
            const epochStartIndex = epochEndIndex - 1;
            const epochTimestampMs = timeBoundaries[epochStartIndex];
            return epochNodeAddressToRaw({
              type: "EPOCH_NODE",
              owner: address,
              epochStart: epochTimestampMs,
            });
          };

          // Split graph edges by direction.
          const unidirectionalGraphEdges = function*(): Iterator<_UnidirectionalGraphEdge> {
            const ewe = edgeWeightEvaluator(wg.weights);
            for (const edge of (function*() {
              for (const edge of wg.graph.edges({showDangling: false})) {
                const weight = ewe(edge.address);
                yield {
                  address: edge.address,
                  reversed: false,
                  src: edge.src,
                  dst: edge.dst,
                  timestamp: edge.timestampMs,
                  weight: weight.forwards,
                };
                yield {
                  address: edge.address,
                  reversed: true,
                  src: edge.dst,
                  dst: edge.src,
                  timestamp: edge.timestampMs,
                  weight: weight.backwards,
                };
              }
            })()) {
              if (edge.weight > 0) {
                yield edge;
              }
            }
          };

          // Domain: (nodes with out-edges) union (epoch nodes)
          const srcNodes: Map<
            NodeAddressT,
            {totalOutWeight: number, outEdges: _UnidirectionalGraphEdge[]}
          > = new Map();
          for (const graphEdge of unidirectionalGraphEdges()) {
            const src = rewriteEpochNode(graphEdge.src, graphEdge.timestamp);
            let datum = srcNodes.get(src);
            if (datum == null) {
              datum = {totalOutWeight: 0, outEdges: []};
              srcNodes.set(src, datum);
            }
            datum.totalOutWeight += graphEdge.weight;
            datum.outEdges.push(graphEdge);
          }
          for (const [src, {totalOutWeight, outEdges}] of srcNodes) {
            const totalOutPr = NodeAddress.hasPrefix(src, EPOCH_PREFIX)
              ? epochTransitionRemainder
              : 1 - seed.alpha;
            for (const outEdge of outEdges) {
              const pr = (outEdge.weight / totalOutWeight) * totalOutPr;
              addEdge({
                address: outEdge.address,
                reversed: outEdge.reversed,
                src: rewriteEpochNode(outEdge.src, outEdge.timestamp),
                dst: rewriteEpochNode(outEdge.dst, outEdge.timestamp),
                transitionProbability: pr,
              });
            }
          }
        }
      }
    }

    return new MarkovProcessGraph(_nodes, _edges, _scoringAddresses);
  }

  scoringAddresses(): Set<NodeAddressT> {
    return new Set(this._scoringAddresses);
  }

  node(address: NodeAddressT): MarkovNode | null {
    NodeAddress.assertValid(address);
    return this._nodes.get(address) || null;
  }

  *nodes(options?: {|+prefix: NodeAddressT|}): Iterator<MarkovNode> {
    const prefix = options ? options.prefix : NodeAddress.empty;
    for (const node of this._nodes.values()) {
      if (NodeAddress.hasPrefix(node.address, prefix)) {
        yield node;
      }
    }
  }

  *edges(): Iterator<MarkovEdge> {
    for (const edge of this._edges.values()) {
      yield edge;
    }
  }

  *inNeighbors(nodeAddress: NodeAddressT): Iterator<MarkovEdge> {
    for (const edge of this._edges.values()) {
      if (edge.dst !== nodeAddress) {
        continue;
      }
      yield edge;
    }
  }

  toMarkovChain(): OrderedSparseMarkovChain {
    const nodeOrder = Array.from(this._nodes.keys()).sort();
    const nodeIndex: Map<
      NodeAddressT,
      number /* index into nodeOrder */
    > = new Map();
    nodeOrder.forEach((n, i) => {
      nodeIndex.set(n, i);
    });

    const inNeighbors: Map<NodeAddressT, MarkovEdge[]> = new Map();
    for (const edge of this._edges.values()) {
      MapUtil.pushValue(inNeighbors, edge.dst, edge);
    }

    const chain = nodeOrder.map((addr) => {
      const inEdges = NullUtil.orElse(inNeighbors.get(addr), []);
      const inDegree = inEdges.length;
      const neighbor = new Uint32Array(inDegree);
      const weight = new Float64Array(inDegree);
      inEdges.forEach((e, i) => {
        // Note: We don't group-by src, so there may be multiple `j`
        // such that `neighbor[j] === k` for a given `k` when there are
        // parallel edges in the source graph. This should just work
        // down the stack..
        const result = nodeIndex.get(e.src);
        if (result == null) {
          throw new Error(e.src);
        }
        neighbor[i] = result;
        weight[i] = e.transitionProbability;
      });
      return {neighbor, weight};
    });

    return {nodeOrder, chain};
  }

  toJSON(): MarkovProcessGraphJSON {
    return {
      nodes: MapUtil.toObject(this._nodes),
      edges: MapUtil.toObject(this._edges),
      scoringAddresses: Array.from(this._scoringAddresses),
    };
  }

  static fromJSON(j: MarkovProcessGraphJSON): MarkovProcessGraph {
    return new MarkovProcessGraph(
      MapUtil.fromObject(j.nodes),
      MapUtil.fromObject(j.edges),
      new Set(j.scoringAddresses)
    );
  }
}

type _UnidirectionalGraphEdge = {|
  +address: EdgeAddressT,
  +reversed: boolean,
  +src: NodeAddressT,
  +dst: NodeAddressT,
  +timestamp: TimestampMs,
  +weight: number,
|};
