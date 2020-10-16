// @flow

import deepFreeze from "deep-freeze";
import {type Uuid} from "../util/uuid";

/**
 * Data structure representing a particular kind of Markov process, as
 * kind of a middle ground between the semantic SourceCred graph (in the
 * `core/graph` module) and a literal transition matrix. Unlike the core
 * graph, edges in a Markov process graph are unidirectional, edge
 * weights are raw transition probabilities (which must sum to 1) rather
 * than unnormalized weights, and there are no dangling edges. Unlike a
 * fully general transition matrix, parallel edges are still reified,
 * not collapsed; nodes have weights, representing sources of flow; and
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
 *   - *base nodes*, which are in 1-to-1 correspondence with the nodes
 *     in the underlying core graph that are not scoring nodes;
 *   - *user-epoch nodes*, which are created for each time period for
 *     each scoring node; and
 *   - *epoch accumulators*, which are created once for each epoch to
 *     aggregate over the epoch nodes,
 *   - the *seed node*, which reifies the teleportation vector and
 *     forces well-definedness and ergodicity of the Markov process (for
 *     nonzero alpha, and assuming that there is at least one edge in
 *     the underlying graph).
 *
 * The edges include:
 *
 *   - *base edges* due to edges in the underlying graph, whose
 *     endpoints are lifted to the corresponding base nodes or to
 *     user-epoch nodes for endpoints that have been fibrated;
 *   - *radiation edges* edges from nodes to the seed node;
 *   - *minting edges* from the seed node to cred-minting nodes;
 *   - *webbing edges* between temporally adjacent user-epoch nodes; and
 *   - *payout edges* from a user-epoch node to the accumulator for its
 *     epoch.
 *
 * A Markov process graph can be converted to a pure Markov chain for
 * spectral analysis via the `toMarkovChain` method.
 */

import sortedIndex from "lodash.sortedindex";
import {makeAddressModule, type AddressModule} from "./address";
import {
  type NodeAddressT,
  NodeAddress,
  type EdgeAddressT,
  EdgeAddress,
} from "./graph";
import {type WeightedGraph as WeightedGraphT} from "./weightedGraph";
import {
  nodeWeightEvaluator,
  edgeWeightEvaluator,
} from "./algorithm/weightEvaluator";
import {toCompat, fromCompat, type Compatible} from "../util/compat";
import * as NullUtil from "../util/null";
import * as MapUtil from "../util/map";
import type {TimestampMs} from "../util/timestamp";
import {type SparseMarkovChain} from "./algorithm/markovChain";
import {type IntervalSequence} from "./interval";

export type TransitionProbability = number;

export type MarkovNode = {|
  // Node address, unique within a Markov process graph. This is either
  // the address of a contribution node or an address under the
  // `sourcecred/core` namespace.
  +address: NodeAddressT,
  // Markdown source description, as in `Node` from `core/graph`.
  +description: string,
  // Amount of cred to mint at this node.
  +mint: number,
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
  // to 1.0 for a given `src`.
  +transitionProbability: TransitionProbability,
|};

export type Participant = {|
  +address: NodeAddressT,
  +description: string,
  +id: Uuid,
|};

export opaque type MarkovEdgeAddressT: string = string;
export const MarkovEdgeAddress: AddressModule<MarkovEdgeAddressT> = (makeAddressModule(
  {
    name: "MarkovEdgeAddress",
    nonce: "ME",
    otherNonces: new Map().set("N", "NodeAddress").set("E", "EdgeAddress"),
  }
): AddressModule<string>);

export function markovEdgeAddress(
  edgeAddress: EdgeAddressT,
  direction: "B" | /* Backward */ "F" /* Forward */
): MarkovEdgeAddressT {
  return MarkovEdgeAddress.fromParts([
    direction,
    ...EdgeAddress.toParts(edgeAddress),
  ]);
}

export function markovEdgeAddressFromMarkovEdge(
  edge: MarkovEdge
): MarkovEdgeAddressT {
  return markovEdgeAddress(
    edge.address,
    edge.reversed ? "B" /* Backward */ : "F" /* Forward */
  );
}

export type OrderedSparseMarkovChain = {|
  +nodeOrder: $ReadOnlyArray<NodeAddressT>,
  +chain: SparseMarkovChain,
|};

export const CORE_NODE_PREFIX: NodeAddressT = NodeAddress.fromParts([
  "sourcecred",
  "core",
]);

// Address of the seed node. All graph nodes radiate $\alpha$ to this
// node, and this node flows out to nodes in proportion to their weight
// (mint). This is also a node prefix for the "seed node" type, which
// contains only one node.
export const SEED_ADDRESS: NodeAddressT = NodeAddress.append(
  CORE_NODE_PREFIX,
  "SEED"
);
export const SEED_DESCRIPTION: string = "\u{1f331}"; // U+1F331 SEEDLING

// Node address prefix for epoch nodes.
const USER_EPOCH_PREFIX = NodeAddress.append(CORE_NODE_PREFIX, "USER_EPOCH");

export type UserEpochNodeAddress = {|
  +type: "USER_EPOCH",
  +owner: NodeAddressT,
  +epochStart: TimestampMs,
|};

export function userEpochNodeAddressToRaw(
  addr: UserEpochNodeAddress
): NodeAddressT {
  return NodeAddress.append(
    USER_EPOCH_PREFIX,
    String(addr.epochStart),
    ...NodeAddress.toParts(addr.owner)
  );
}

export function userEpochNodeAddressFromRaw(
  addr: NodeAddressT
): UserEpochNodeAddress {
  if (!NodeAddress.hasPrefix(addr, USER_EPOCH_PREFIX)) {
    throw new Error("Not an epoch node address: " + NodeAddress.toString(addr));
  }
  const epochPrefixLength = NodeAddress.toParts(USER_EPOCH_PREFIX).length;
  const parts = NodeAddress.toParts(addr);
  const epochStart = +parts[epochPrefixLength];
  const owner = NodeAddress.fromParts(parts.slice(epochPrefixLength + 1));
  return {
    type: "USER_EPOCH",
    owner,
    epochStart,
  };
}

// TODO(@wchargin): Expose more cleanly.
export const EPOCH_ACCUMULATOR_PREFIX: NodeAddressT = NodeAddress.append(
  CORE_NODE_PREFIX,
  "EPOCH"
);

export type EpochAccumulatorAddress = {|
  +type: "EPOCH_ACCUMULATOR",
  +epochStart: TimestampMs,
|};

export function epochAccumulatorAddressToRaw(
  addr: EpochAccumulatorAddress
): NodeAddressT {
  return NodeAddress.append(EPOCH_ACCUMULATOR_PREFIX, String(addr.epochStart));
}

export function epochAccumulatorAddressFromRaw(
  addr: NodeAddressT
): EpochAccumulatorAddress {
  if (!NodeAddress.hasPrefix(addr, EPOCH_ACCUMULATOR_PREFIX)) {
    throw new Error("Not an epoch node address: " + NodeAddress.toString(addr));
  }
  const prefixLength = NodeAddress.toParts(EPOCH_ACCUMULATOR_PREFIX).length;
  const parts = NodeAddress.toParts(addr);
  const epochStart = +parts[prefixLength];
  return {
    type: "EPOCH_ACCUMULATOR",
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

export function payoutAddressForEpoch(
  participantEpoch: UserEpochNodeAddress
): EdgeAddressT {
  const {epochStart, owner} = participantEpoch;
  return EdgeAddress.append(
    EPOCH_PAYOUT,
    String(epochStart),
    ...NodeAddress.toParts(owner)
  );
}

export const EPOCH_WEBBING: EdgeAddressT = EdgeAddress.append(
  FIBRATION_EDGE,
  "EPOCH_WEBBING"
);
export const USER_EPOCH_RADIATION: EdgeAddressT = EdgeAddress.append(
  FIBRATION_EDGE,
  "USER_EPOCH_RADIATION"
);
export const EPOCH_ACCUMULATOR_RADIATION: EdgeAddressT = EdgeAddress.append(
  FIBRATION_EDGE,
  "EPOCH_RADIATION"
);

// Prefixes for seed edges.
export const CONTRIBUTION_RADIATION: EdgeAddressT = EdgeAddress.fromParts([
  "sourcecred",
  "core",
  "CONTRIBUTION_RADIATION",
]);
export const SEED_MINT: EdgeAddressT = EdgeAddress.fromParts([
  "sourcecred",
  "core",
  "SEED_MINT",
]);

export type Arguments = {|
  +weightedGraph: WeightedGraphT,
  +participants: $ReadOnlyArray<Participant>,
  +intervals: IntervalSequence,
  +parameters: Parameters,
|};

export type Parameters = {|
  // Transition probability from every organic node back to the seed node.
  +alpha: TransitionProbability,
  // Transition probability for payout edges from epoch nodes to their
  // owners.
  +beta: TransitionProbability,
  // Transition probability for webbing edges from an epoch node to the
  // next epoch node for the same owner.
  +gammaForward: TransitionProbability,
  +gammaBackward: TransitionProbability,
|};

export const COMPAT_INFO = {
  type: "sourcecred/markovProcessGraph",
  version: "0.1.0",
};

// A MarkovEdge in which the src and dst have been replaced with indices instead
// of full addresses. The indexing is based on the order of nodes in the MarkovProcessGraphJSON.
export type IndexedMarkovEdge = {|
  +address: EdgeAddressT,
  +reversed: boolean,
  +src: number,
  +dst: number,
  +transitionProbability: TransitionProbability,
|};
export type MarkovProcessGraphJSON = Compatible<{|
  +nodes: $ReadOnlyArray<MarkovNode>,
  +indexedEdges: $ReadOnlyArray<IndexedMarkovEdge>,
  +participants: $ReadOnlyArray<Participant>,
  // The -Infinity and +Infinity epoch boundaries must be stripped before
  // JSON serialization.
  +finiteEpochBoundaries: $ReadOnlyArray<number>,
|}>;

export class MarkovProcessGraph {
  _nodes: $ReadOnlyMap<NodeAddressT, MarkovNode>;
  _edges: $ReadOnlyMap<MarkovEdgeAddressT, MarkovEdge>;
  _participants: $ReadOnlyArray<Participant>;
  _epochBoundaries: $ReadOnlyArray<number>;

  constructor(
    nodes: Map<NodeAddressT, MarkovNode>,
    edges: Map<MarkovEdgeAddressT, MarkovEdge>,
    participants: $ReadOnlyArray<Participant>,
    epochBoundaries: $ReadOnlyArray<number>
  ) {
    this._nodes = nodes;
    this._edges = edges;
    this._epochBoundaries = deepFreeze(epochBoundaries);
    this._participants = deepFreeze(participants);
  }

  static new(args: Arguments): MarkovProcessGraph {
    const {weightedGraph, participants, parameters, intervals} = args;
    const {alpha, beta, gammaForward, gammaBackward} = parameters;
    const _nodes = new Map();
    const _edges = new Map();

    const _scoringAddresses = new Set(participants.map((p) => p.address));

    // _nodeOutMasses[a] = sum(e.pr for e in edges if e.src == a)
    // Used for computing remainder-to-seed edges.
    const _nodeOutMasses = new Map();

    // Amount of mass allocated to contribution edges flowing from epoch
    // nodes.
    const epochTransitionRemainder: number = (() => {
      const valid = (x) => x >= 0 && x <= 1;
      if (
        !valid(beta) ||
        !valid(gammaForward) ||
        !valid(gammaBackward) ||
        !valid(alpha)
      ) {
        throw new Error(
          "Invalid transition probability: " +
            [beta, gammaForward, gammaBackward, alpha].join(" or ")
        );
      }
      const result = 1 - (alpha + beta + gammaForward + gammaBackward);
      if (result < 0) {
        throw new Error("Overlarge transition probability: " + (1 - result));
      }
      return result;
    })();

    const timeBoundaries = [
      -Infinity,
      ...intervals.map((x) => x.startTimeMs),
      Infinity,
    ];

    const addNode = (node: MarkovNode) => {
      if (_nodes.has(node.address)) {
        throw new Error("Node conflict: " + node.address);
      }
      _nodes.set(node.address, node);
    };
    const addEdge = (edge: MarkovEdge) => {
      const mae = markovEdgeAddressFromMarkovEdge(edge);
      if (_edges.has(mae)) {
        throw new Error("Edge conflict: " + mae);
      }
      const pr = edge.transitionProbability;
      if (pr < 0 || pr > 1) {
        const name = MarkovEdgeAddress.toString(mae);
        throw new Error(`Invalid transition probability for ${name}: ${pr}`);
      }
      _edges.set(mae, edge);
      _nodeOutMasses.set(edge.src, (_nodeOutMasses.get(edge.src) || 0) + pr);
    };

    // Add seed node
    addNode({
      address: SEED_ADDRESS,
      description: SEED_DESCRIPTION,
      mint: 0,
    });

    // Add graph nodes
    const nwe = nodeWeightEvaluator(weightedGraph.weights);
    for (const node of weightedGraph.graph.nodes()) {
      if (_scoringAddresses.has(node.address)) {
        // Scoring nodes are not included in the Markov process graph:
        // the cred for a scoring node is given implicitly by the
        // weight-sum of its epoch accumulation edges.
        continue;
      }
      const weight = nwe(node.address);
      if (weight < 0 || !Number.isFinite(weight)) {
        const name = NodeAddress.toString(node.address);
        throw new Error(`Bad node weight for ${name}: ${weight}`);
      }
      if (NodeAddress.hasPrefix(node.address, CORE_NODE_PREFIX)) {
        throw new Error(
          "Unexpected core node in underlying graph: " +
            NodeAddress.toString(node.address)
        );
      }
      addNode({
        address: node.address,
        description: node.description,
        mint: weight,
      });
    }

    // Add epoch nodes, epoch accumulators, payout edges, and epoch webbing
    let lastBoundary = null;
    for (const boundary of timeBoundaries) {
      const accumulator = epochAccumulatorAddressToRaw({
        type: "EPOCH_ACCUMULATOR",
        epochStart: boundary,
      });
      addNode({
        address: accumulator,
        description: `Epoch accumulator starting ${boundary} ms past epoch`,
        mint: 0,
      });
      for (const scoringAddress of _scoringAddresses) {
        const thisEpochStructured = {
          type: "USER_EPOCH",
          owner: scoringAddress,
          epochStart: boundary,
        };
        const thisEpoch = userEpochNodeAddressToRaw(thisEpochStructured);
        addNode({
          address: thisEpoch,
          description: `Epoch starting ${boundary} ms past epoch`,
          mint: 0,
        });
        addEdge({
          address: payoutAddressForEpoch(thisEpochStructured),
          reversed: false,
          src: thisEpoch,
          dst: accumulator,
          transitionProbability: beta,
        });
        if (lastBoundary != null) {
          const lastEpoch = userEpochNodeAddressToRaw({
            type: "USER_EPOCH",
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
            transitionProbability: gammaForward,
          });
          addEdge({
            address: webAddress,
            reversed: true,
            src: thisEpoch,
            dst: lastEpoch,
            transitionProbability: gammaBackward,
          });
        }
        lastBoundary = boundary;
      }
    }

    // Add minting edges, from the seed to positive-weight graph nodes
    {
      let totalNodeWeight = 0.0;
      const positiveNodeWeights: Map<NodeAddressT, number> = new Map();
      for (const {address, mint} of _nodes.values()) {
        if (mint > 0) {
          totalNodeWeight += mint;
          positiveNodeWeights.set(address, mint);
        }
      }
      if (!(totalNodeWeight > 0)) {
        throw new Error("No outflow from seed; add cred-minting nodes");
      }
      for (const [address, weight] of positiveNodeWeights) {
        addEdge({
          address: EdgeAddress.append(
            SEED_MINT,
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
      edgeTimestampMs: TimestampMs
    ): NodeAddressT => {
      if (!_scoringAddresses.has(address)) {
        return address;
      }
      const epochEndIndex = sortedIndex(timeBoundaries, edgeTimestampMs);
      const epochStartIndex = epochEndIndex - 1;
      const epochTimestampMs = timeBoundaries[epochStartIndex];
      return userEpochNodeAddressToRaw({
        type: "USER_EPOCH",
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
      const ewe = edgeWeightEvaluator(weightedGraph.weights);
      for (const edge of (function* () {
        for (const edge of weightedGraph.graph.edges({showDangling: false})) {
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
      NodeAddressT /* domain: nodes with positive weight from base edges */,
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
      const totalOutPr = NodeAddress.hasPrefix(src, USER_EPOCH_PREFIX)
        ? epochTransitionRemainder
        : 1 - alpha;
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

    // Add radiation edges
    for (const node of _nodes.values()) {
      if (node.address === SEED_ADDRESS) continue;
      let type;
      if (NodeAddress.hasPrefix(node.address, USER_EPOCH_PREFIX)) {
        type = USER_EPOCH_RADIATION;
      } else if (
        NodeAddress.hasPrefix(node.address, EPOCH_ACCUMULATOR_PREFIX)
      ) {
        type = EPOCH_ACCUMULATOR_RADIATION;
      } else if (NodeAddress.hasPrefix(node.address, CORE_NODE_PREFIX)) {
        throw new Error(
          "invariant violation: unknown core node: " +
            NodeAddress.toString(node.address)
        );
      } else {
        type = CONTRIBUTION_RADIATION;
      }
      addEdge({
        address: EdgeAddress.append(type, ...NodeAddress.toParts(node.address)),
        reversed: false,
        src: node.address,
        dst: SEED_ADDRESS,
        transitionProbability:
          1 - NullUtil.orElse(_nodeOutMasses.get(node.address), 0),
      });
    }

    return new MarkovProcessGraph(_nodes, _edges, participants, timeBoundaries);
  }

  epochBoundaries(): $ReadOnlyArray<number> {
    return this._epochBoundaries;
  }

  participants(): $ReadOnlyArray<Participant> {
    return this._participants;
  }

  /**
   * Returns a canonical ordering of the nodes in the graph.
   *
   * No assumptions should be made about the node order, other than
   * that it is stable for any given MarkovProcessGraph.
   */
  *nodeOrder(): Iterator<NodeAddressT> {
    yield* this._nodes.keys();
  }

  node(address: NodeAddressT): MarkovNode | null {
    NodeAddress.assertValid(address);
    return this._nodes.get(address) || null;
  }

  /**
   * Iterate over the nodes in the graph. If a prefix is provided,
   * only nodes matching that prefix will be returned.
   *
   * The nodes are always iterated over in the node order.
   */
  *nodes(options?: {|+prefix: NodeAddressT|}): Iterator<MarkovNode> {
    const prefix = options ? options.prefix : NodeAddress.empty;
    for (const [address, markovNode] of this._nodes) {
      if (NodeAddress.hasPrefix(address, prefix)) {
        yield markovNode;
      }
    }
  }

  /**
   * Returns a canonical ordering of the edges in the graph.
   *
   * No assumptions should be made about the edge order, other than
   * that it is stable for any given MarkovProcessGraph.
   */
  *edgeOrder(): Iterator<MarkovEdgeAddressT> {
    yield* this._edges.keys();
  }

  edge(address: MarkovEdgeAddressT): MarkovEdge | null {
    MarkovEdgeAddress.assertValid(address);
    return this._edges.get(address) || null;
  }

  /**
   * Iterate over the edges in the graph.
   *
   * The edges are always iterated over in the edge order.
   */
  *edges(): Iterator<MarkovEdge> {
    yield* this._edges.values();
  }

  *inNeighbors(nodeAddress: NodeAddressT): Iterator<MarkovEdge> {
    for (const edge of this.edges()) {
      if (edge.dst !== nodeAddress) {
        continue;
      }
      yield edge;
    }
  }

  toMarkovChain(): OrderedSparseMarkovChain {
    // We will need to map over the nodes, so we array-ify it upfront
    const nodes = Array.from(this.nodes());
    const nodeIndex: Map<
      NodeAddressT,
      number /* index into nodeOrder */
    > = new Map();
    nodes.forEach((n, i) => {
      nodeIndex.set(n.address, i);
    });

    // Check that out-edges sum to about 1.
    const nodeOutMasses = new Map();
    for (const {address} of nodes) {
      nodeOutMasses.set(address, 0);
    }
    for (const edge of this.edges()) {
      const a = edge.src;
      nodeOutMasses.set(
        a,
        NullUtil.get(nodeOutMasses.get(a)) + edge.transitionProbability
      );
    }
    for (const [node, outMass] of nodeOutMasses) {
      const discrepancy = outMass - 1;
      if (Math.abs(discrepancy) > 1e-3) {
        const name = NodeAddress.toString(node);
        throw new Error(
          `Transition weights for ${name} do not sum to 1.0: ${outMass}`
        );
      }
    }

    const inNeighbors: Map<NodeAddressT, MarkovEdge[]> = new Map();
    for (const edge of this.edges()) {
      MapUtil.pushValue(inNeighbors, edge.dst, edge);
    }

    const chain = nodes.map(({address}) => {
      const inEdges = NullUtil.orElse(inNeighbors.get(address), []);
      const inDegree = inEdges.length;
      const neighbor = new Uint32Array(inDegree);
      const weight = new Float64Array(inDegree);
      inEdges.forEach((e, i) => {
        // Note: We don't group-by src, so there may be multiple `j`
        // such that `neighbor[j] === k` for a given `k` when there are
        // parallel edges in the source graph. This should just work
        // down the stack.
        const srcIndex = nodeIndex.get(e.src);
        if (srcIndex == null) {
          throw new Error(e.src);
        }
        neighbor[i] = srcIndex;
        weight[i] = e.transitionProbability;
      });
      return {neighbor, weight};
    });

    return {nodeOrder: nodes.map((x) => x.address), chain};
  }

  toJSON(): MarkovProcessGraphJSON {
    const nodeIndex: Map<
      NodeAddressT,
      number /* index into nodeOrder */
    > = new Map();
    let i = 0;
    for (const addr of this.nodeOrder()) {
      nodeIndex.set(addr, i++);
    }
    const indexedEdges = Array.from(this.edges()).map((e) => ({
      address: e.address,
      reversed: e.reversed,
      src: NullUtil.get(nodeIndex.get(e.src)),
      dst: NullUtil.get(nodeIndex.get(e.dst)),
      transitionProbability: e.transitionProbability,
    }));
    return toCompat(COMPAT_INFO, {
      nodes: [...this._nodes.values()],
      indexedEdges,
      participants: this._participants,
      finiteEpochBoundaries: this._epochBoundaries.slice(
        1,
        this._epochBoundaries.length - 1
      ),
    });
  }

  static fromJSON(j: MarkovProcessGraphJSON): MarkovProcessGraph {
    const {
      sortedNodes,
      indexedEdges,
      participants,
      finiteEpochBoundaries,
    } = fromCompat(COMPAT_INFO, j);
    const edges = indexedEdges.map((e) => ({
      address: e.address,
      reversed: e.reversed,
      src: sortedNodes[e.src].address,
      dst: sortedNodes[e.dst].address,
      transitionProbability: e.transitionProbability,
    }));

    return new MarkovProcessGraph(
      new Map(sortedNodes.map((n) => [n.address, n])),
      new Map(edges.map((e) => [e.address, e])),
      participants,
      [-Infinity, ...finiteEpochBoundaries, Infinity]
    );
  }
}
