// @flow

/**
 * Data structure representing a particular kind of Markov process, as
 * kind of a middle ground between the semantic SourceCred graph (in the
 * `core/graph` module) and a literal transition matrix. Unlike the core
 * graph, edges in a Markov process graph are unidirectional, edge
 * weights are raw transition probabilities (which must sum to 1) rather
 * than unnormalized weights, and there are no dangling edges. Unlike a
 * fully general transition matrix, parallel edges are still reified,
 * not collapsed; nodes have weights, representing sources of flow, and
 * a few SourceCred-specific concepts are made first-class:
 * specifically, cred minting and time period fibration. The
 * "teleportation vector" from PageRank is also made explicit via the
 * "adjoined seed node" graph transformation strategy, so this data
 * structure can form well-defined Markov processes even from graphs
 * with nodes with no out-weight. Because the graph reifies the
 * teleportation and temporal fibration, the associated parameters are
 * "baked in" to weights of the Markov process graph.
 *
 * We use the term "fibration" to refer to a graph transformation where
 * each scoring node is split into one node per epoch, and incident
 * edges are rewritten to point to the appropriate epoch nodes. The term
 * is vaguely inspired from the notion of a fiber bundle, though the
 * analogy is not precise.
 *
 * The Markov process graphs in this module have three kinds of nodes:
 *
 *   - *contribution nodes*, which are in 1-to-1 correspondence with the
 *     nodes in the underlying core graph (including users);
 *   - *epoch nodes*, which are created for each time period for each
 *     scoring node; and
 *   - the *seed node*, which reifies the teleportation vector and
 *     forces well-definedness and ergodicity of the Markov process (for
 *     nonzero alpha, and assuming that there is at least one edge in
 *     the underlying graph).
 *
 * The edges include:
 *
 *   - *contribution edges* between nodes in the underlying graph, which
 *     are lifted to their corresponding contribution nodes or to epoch
 *     nodes if either endpoint has been fibrated;
 *   - *seed-in* / "redistribution" / "radiation" edges from nodes to
 *     the seed node;
 *   - *seed-out* / "minting" edges from the seed node to cred-minting
 *     nodes;
 *   - *webbing edges* between temporally adjacent epoch nodes; and
 *   - *payout edges* from an epoch node to its owner (a scoring node).
 *
 * A Markov process graph can be converted to a pure Markov chain for
 * spectral analysis via the `toMarkovChain` method.
 */

import {max, min} from "d3-array";
import {weekIntervals} from "./interval";
import sortedIndex from "lodash.sortedindex";
import {makeAddressModule, type AddressModule} from "./address";
import {
  type NodeAddressT,
  NodeAddress,
  type EdgeAddressT,
  EdgeAddress,
  type Graph,
} from "./graph";
import {type WeightedGraph as WeightedGraphT} from "./weightedGraph";
import {type NodeWeight} from "./weights";
import {
  nodeWeightEvaluator,
  edgeWeightEvaluator,
} from "./algorithm/weightEvaluator";
import {toCompat, fromCompat, type Compatible} from "../util/compat";
import * as NullUtil from "../util/null";
import * as MapUtil from "../util/map";
import {type SparseMarkovChain} from "./algorithm/markovChain";

export type TimestampMs = number;
export type TransitionProbability = number;

export type MarkovNode = {|
  // Node address, unique within a Markov process graph. This is either
  // the address of a contribution node or an address under the
  // `sourcecred/core` namespace.
  +address: NodeAddressT,
  // Markdown source description, as in `Node` from `core/graph`.
  +description: string,
  // Amount of cred to mint at this node.
  +weight: NodeWeight,
|};
export type MarkovEdge = {|
  // Address of the underlying edge. Note that this attribute alone does
  // not uniquely identify an edge in the Markov process graph; the
  // primary key is `(address, reversed)`, not just `address`. For edges
  // not in the underlying graph (e.g., fibration edges), this will be
  // an address under the `sourcecred/core` namespace.
  +address: EdgeAddressT,
  // If this came from an underlying graph edge or an epoch webbing
  // edge, have its `src` and `dst` been swapped in the process of
  // handling the reverse component of a bidirectional edge?
  +reversed: boolean,
  // Source node at the Markov chain level.
  +src: NodeAddressT,
  // Destination node at the Markov chain level.
  +dst: NodeAddressT,
  // Transition probability: $Pr[X_{n+1} = dst | X_{n} = src]$. Must sum
  // to unity for a given `src`.
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

function rawEdgeAddress(edge: MarkovEdge): MarkovEdgeAddressT {
  return MarkovEdgeAddress.fromParts([
    edge.reversed ? "B" /* Backward */ : "F" /* Forward */,
    ...EdgeAddress.toParts(edge.address),
  ]);
}

export type OrderedSparseMarkovChain = {|
  +nodeOrder: $ReadOnlyArray<NodeAddressT>,
  +chain: SparseMarkovChain,
|};

// Address of a seed node. All graph nodes tithe $\alpha$ to this node,
// and this node flows out to nodes in proportion to their weight. This
// is also a node prefix for the "seed node" type, which contains only
// one node.
const SEED_ADDRESS = NodeAddress.fromParts(["sourcecred", "core", "SEED"]);
const SEED_DESCRIPTION = "\u{1f331}"; // SEEDLING

// Node address prefix for epoch nodes.
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
    throw new Error("Not an epoch node address: " + NodeAddress.toString(addr));
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

// Prefixes for fibration edges.
const FIBRATION_EDGE = EdgeAddress.fromParts([
  "sourcecred",
  "core",
  "fibration",
]);
const EPOCH_PAYOUT = EdgeAddress.append(FIBRATION_EDGE, "EPOCH_PAYOUT");
const EPOCH_WEBBING = EdgeAddress.append(FIBRATION_EDGE, "EPOCH_WEBBING");
// Prefixes for seed edges.
const SEED_IN = EdgeAddress.fromParts(["sourcecred", "core", "SEED_IN"]);
const SEED_OUT = EdgeAddress.fromParts(["sourcecred", "core", "SEED_OUT"]);

export type FibrationOptions = {|
  // List of node prefixes for temporal fibration. A node with address
  // `a` will be fibrated if `NodeAddress.hasPrefix(node, prefix)` for
  // some element `prefix` of `what`.
  +what: $ReadOnlyArray<NodeAddressT>,
  // Transition probability for payout edges from epoch nodes to their
  // owners.
  +beta: TransitionProbability,
  // Transition probability for webbing edges from an epoch node to the
  // next epoch node for the same owner.
  +gammaForward: TransitionProbability,
  +gammaBackward: TransitionProbability,
|};
export type SeedOptions = {|
  +alpha: TransitionProbability,
|};

const COMPAT_INFO = {type: "sourcecred/markovProcessGraph", version: "0.1.0"};

export type MarkovProcessGraphJSON = Compatible<{|
  +nodes: {|+[NodeAddressT]: MarkovNode|},
  +edges: {|+[MarkovEdgeAddressT]: MarkovEdge|},
  +scoringAddresses: $ReadOnlyArray<NodeAddressT>,
|}>;

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
    const _scoringAddresses = _findScoringAddresses(wg.graph, fibration.what);

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
        throw new Error("Overlarge transition probability: " + (1 - result));
      }
      return result;
    })();

    const timeBoundaries = (() => {
      const edgeTimestamps = Array.from(
        wg.graph.edges({showDangling: false})
      ).map((x) => x.timestampMs);
      const start = min(edgeTimestamps);
      const end = max(edgeTimestamps);
      const boundaries = weekIntervals(start, end).map((x) => x.startTimeMs);
      return [-Infinity, ...boundaries, Infinity];
    })();

    const addNode = (node: MarkovNode) => {
      if (_nodes.has(node.address)) {
        throw new Error("Node conflict: " + node.address);
      }
      _nodes.set(node.address, node);
    };
    const addEdge = (edge: MarkovEdge) => {
      const mae = rawEdgeAddress(edge);
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
        const name = NodeAddress.toString(node.address);
        throw new Error(`Negative node weight for ${name}: ${weight}`);
      }
      addNode({
        address: node.address,
        description: node.description,
        weight,
      });
    }

    // Add epoch nodes, payout edges, and epoch webbing
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
          description: `Epoch starting ${boundary} ms past epoch`,
          weight: 0,
        });
        addEdge({
          address: EdgeAddress.append(
            EPOCH_PAYOUT,
            String(boundary),
            ...NodeAddress.toParts(scoringAddress)
          ),
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
          const webAddress = EdgeAddress.append(
            EPOCH_WEBBING,
            String(boundary),
            ...NodeAddress.toParts(scoringAddress)
          );
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

    // Add radiation (seed-in) edges
    for (const node of wg.graph.nodes()) {
      addEdge({
        address: EdgeAddress.append(
          SEED_IN,
          ...NodeAddress.toParts(node.address)
        ),
        reversed: false,
        src: node.address,
        dst: SEED_ADDRESS,
        transitionProbability: seed.alpha,
      });
    }

    // Add minting (seed-out) edges
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
        throw new Error("No outflow from seed; add cred-minting nodes");
      }
      for (const [address, weight] of positiveNodeWeights) {
        addEdge({
          address: EdgeAddress.append(
            SEED_OUT,
            ...NodeAddress.toParts(address)
          ),
          reversed: false,
          src: SEED_ADDRESS,
          dst: address,
          transitionProbability: weight / totalNodeWeight,
        });
      }
    }

    /**
     * Find an epoch node, or just the original node if it's not a
     * scoring address.
     */
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

    // Add graph edges. First, split by direction.
    type _UnidirectionalGraphEdge = {|
      +address: EdgeAddressT,
      +reversed: boolean,
      +src: NodeAddressT,
      +dst: NodeAddressT,
      +timestamp: TimestampMs,
      +weight: number,
    |};
    const unidirectionalGraphEdges = function* (): Iterator<_UnidirectionalGraphEdge> {
      const ewe = edgeWeightEvaluator(wg.weights);
      for (const edge of (function* () {
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

    const srcNodes: Map<
      NodeAddressT /* domain: (nodes with out-edges) U (epoch nodes) */,
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
        // down the stack.
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
    return toCompat(COMPAT_INFO, {
      nodes: MapUtil.toObject(this._nodes),
      edges: MapUtil.toObject(this._edges),
      scoringAddresses: Array.from(this._scoringAddresses),
    });
  }

  static fromJSON(j: MarkovProcessGraphJSON): MarkovProcessGraph {
    const data = fromCompat(COMPAT_INFO, j);
    return new MarkovProcessGraph(
      MapUtil.fromObject(data.nodes),
      MapUtil.fromObject(data.edges),
      new Set(data.scoringAddresses)
    );
  }
}

/** Find addresses of all nodes matching any of the scoring prefixes. */
function _findScoringAddresses(
  graph: Graph,
  scoringPrefixes: $ReadOnlyArray<NodeAddressT>
): Set<NodeAddressT> {
  const result = new Set();
  for (const {address} of graph.nodes()) {
    if (scoringPrefixes.some((p) => NodeAddress.hasPrefix(address, p))) {
      result.add(address);
    }
  }
  return result;
}
