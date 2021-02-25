// @flow

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

import deepFreeze from "deep-freeze";
import {type Uuid, parser as uuidParser} from "../../util/uuid";
import * as C from "../../util/combo";
import sortedIndex from "lodash.sortedindex";
import {
  type NodeAddressT,
  NodeAddress,
  type EdgeAddressT,
  EdgeAddress,
} from "../graph";
import {type WeightedGraph as WeightedGraphT} from "../weightedGraph";
import {
  nodeWeightEvaluator,
  edgeWeightEvaluator,
} from "../algorithm/weightEvaluator";
import * as NullUtil from "../../util/null";
import * as MapUtil from "../../util/map";
import type {TimestampMs} from "../../util/timestamp";
import {type SparseMarkovChain} from "../algorithm/markovChain";
import {type IntervalSequence, intervalSequence} from "../interval";
import {
  personalAttributionsParser,
  type PersonalAttributions,
  IndexedPersonalAttributions,
} from "./personalAttribution";

import {type MarkovNode, parser as markovNodeParser} from "./markovNode";

import {
  type MarkovEdge,
  type MarkovEdgeAddressT,
  type TransitionProbability,
  MarkovEdgeAddress,
  markovEdgeAddressFromMarkovEdge,
} from "./markovEdge";

import {
  seedGadget,
  accumulatorGadget,
  epochGadget,
  GADGET_NODE_PREFIX,
} from "./nodeGadgets";

import {
  radiationGadget,
  seedMintGadget,
  payoutGadget,
  forwardWebbingGadget,
  backwardWebbingGadget,
  personalAttributionGadget,
} from "./edgeGadgets";

export type Participant = {|
  +address: NodeAddressT,
  +description: string,
  +id: Uuid,
|};

export const participantParser: C.Parser<Participant> = C.object({
  address: NodeAddress.parser,
  description: C.string,
  id: uuidParser,
});

export type OrderedSparseMarkovChain = {|
  +nodeOrder: $ReadOnlyArray<NodeAddressT>,
  +chain: SparseMarkovChain,
|};

export type Arguments = {|
  +weightedGraph: WeightedGraphT,
  +participants: $ReadOnlyArray<Participant>,
  +intervals: IntervalSequence,
  +parameters: Parameters,
  +personalAttributions: PersonalAttributions,
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

export const parametersParser: C.Parser<Parameters> = C.object({
  alpha: C.number,
  beta: C.number,
  gammaForward: C.number,
  gammaBackward: C.number,
});

// A MarkovEdge in which the src and dst have been replaced with indices instead
// of full addresses. The indexing is based on the order of nodes in the MarkovProcessGraphJSON.
export type IndexedMarkovEdge = {|
  +address: EdgeAddressT,
  +reversed: boolean,
  +src: number,
  +dst: number,
  +transitionProbability: TransitionProbability,
|};

const indexedEdgeParser: C.Parser<IndexedMarkovEdge> = C.object({
  address: EdgeAddress.parser,
  reversed: C.boolean,
  src: C.number,
  dst: C.number,
  transitionProbability: C.number,
});

export type MarkovProcessGraphJSON = {|
  +nodes: $ReadOnlyArray<MarkovNode>,
  +indexedEdges: $ReadOnlyArray<IndexedMarkovEdge>,
  +participants: $ReadOnlyArray<Participant>,
  +epochStarts: $ReadOnlyArray<number>,
  +lastEpochEndMs: number,
  +parameters: Parameters,
  +radiationTransitionProbabilities: $ReadOnlyArray<number>,
  // Array of [nodeIndex, transitionProbability] tuples representing all of the
  // connections from the seed node to nodes minting Cred.
  +indexedMints: $ReadOnlyArray<[number, number]>,
  +personalAttributions: PersonalAttributions,
|};

export class MarkovProcessGraph {
  _nodes: $ReadOnlyMap<NodeAddressT, MarkovNode>;
  _edges: $ReadOnlyMap<MarkovEdgeAddressT, MarkovEdge>;
  _participants: $ReadOnlyArray<Participant>;
  _epochStarts: $ReadOnlyArray<number>;
  +_lastEpochEndMs: number;
  _parameters: Parameters;
  _mintTransitionProbabilties: $ReadOnlyMap<NodeAddressT, number>;
  _radiationTransitionProbabilties: $ReadOnlyArray<number>;
  _nodeIndex: $ReadOnlyMap<NodeAddressT, number>;
  _edgeIndex: $ReadOnlyMap<MarkovEdgeAddressT, number>;
  _indexedPersonalAttributions: IndexedPersonalAttributions;

  constructor(
    nodes: Map<NodeAddressT, MarkovNode>,
    edges: Map<MarkovEdgeAddressT, MarkovEdge>,
    participants: $ReadOnlyArray<Participant>,
    epochStarts: $ReadOnlyArray<number>,
    lastEpochEndMs: number,
    parameters: Parameters,
    // Map from each node address to the proportion of total minting (i.e. its
    // transition probability from the seed node). Must sum to about 1.
    mintTransitionProbabilities: $ReadOnlyMap<NodeAddressT, number>,
    // Transition probabilities for radiation edges, in node order
    radiationTransitionProbabilities: $ReadOnlyArray<number>,
    indexedPersonalAttributions: IndexedPersonalAttributions
  ) {
    this._nodes = nodes;
    this._edges = edges;
    this._epochStarts = deepFreeze(epochStarts);
    this._lastEpochEndMs = lastEpochEndMs;
    this._participants = deepFreeze(participants);
    this._parameters = deepFreeze(parameters);
    this._radiationTransitionProbabilties = deepFreeze(
      radiationTransitionProbabilities
    );
    this._mintTransitionProbabilties = mintTransitionProbabilities;
    // Precompute the index maps
    this._nodeIndex = new Map(
      [..._nodeOrder(nodes, epochStarts, participants)].map((a, i) => [a, i])
    );
    this._edgeIndex = new Map(
      [
        ...edges.keys(),
        ...virtualizedMarkovEdgeAddresses(
          epochStarts,
          participants,
          mintTransitionProbabilities,
          _nodeOrder(nodes, epochStarts, participants),
          indexedPersonalAttributions
        ),
      ].map((a, i) => [a, i])
    );
    this._indexedPersonalAttributions = indexedPersonalAttributions;
  }

  static new(args: Arguments): MarkovProcessGraph {
    const {
      weightedGraph,
      participants,
      parameters,
      intervals,
      personalAttributions,
    } = args;
    const {alpha, beta, gammaForward, gammaBackward} = parameters;
    const _nodes = new Map();
    const _edges = new Map();

    const _scoringAddressToId = new Map(
      participants.map((p) => [p.address, p.id])
    );
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

    if (intervals.length === 0) {
      throw new Error("need at least one interval");
    }
    const epochStarts = intervals.map((x) => x.startTimeMs);
    const lastEpochEndMs = intervals[intervals.length - 1].endTimeMs;
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
      _edges.set(mae, edge);
      recordTransitionProbability(edge);
    };
    const recordTransitionProbability = (edge: MarkovEdge) => {
      const pr = edge.transitionProbability;
      if (pr < 0 || pr > 1) {
        const mae = markovEdgeAddressFromMarkovEdge(edge);
        const name = MarkovEdgeAddress.toString(mae);
        throw new Error(`Invalid transition probability for ${name}: ${pr}`);
      }
      _nodeOutMasses.set(edge.src, (_nodeOutMasses.get(edge.src) || 0) + pr);
    };

    const indexedPersonalAttributions = new IndexedPersonalAttributions(
      personalAttributions,
      epochStarts
    );

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
      if (NodeAddress.hasPrefix(node.address, GADGET_NODE_PREFIX)) {
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
    let lastEpochStart = null;
    for (const epochStart of epochStarts) {
      for (const participant of participants) {
        const thisEpoch = {
          owner: participant.id,
          epochStart,
        };
        recordTransitionProbability(payoutGadget.markovEdge(thisEpoch, beta));
        if (lastEpochStart != null) {
          const webbingAddress = {
            thisStart: epochStart,
            lastStart: lastEpochStart,
            owner: participant.id,
          };
          recordTransitionProbability(
            forwardWebbingGadget.markovEdge(webbingAddress, gammaForward)
          );
          recordTransitionProbability(
            backwardWebbingGadget.markovEdge(webbingAddress, gammaBackward)
          );
        } else {
          // There is no lastEpochStart, which means this is the first epoch. We will instead create a "backwards"
          // edge which is actually a loop, so as to avoid Cred distortion where scores are biased downward
          // for the first epoch.
          const webbingAddress = {
            thisStart: epochStart,
            lastStart: epochStart,
            owner: participant.id,
          };
          const edge = backwardWebbingGadget.markovEdge(
            webbingAddress,
            gammaBackward
          );
          recordTransitionProbability(edge);
        }
      }
      lastEpochStart = epochStart;
    }
    if (lastEpochStart == null) {
      // Just to satisfy flow when adding the final "forward" webbing edges (which are loops).
      throw new Error(`invariant violation: there were no epochs`);
    }
    // Now for the last epochStart, we create a "forwards" webbing edge which is actually a loop, as as to
    // avoid Cred distortion where the scores are biased downward for the last epoch.
    for (const participant of participants) {
      const webbingAddress = {
        thisStart: lastEpochStart,
        lastStart: lastEpochStart,
        owner: participant.id,
      };
      const edge = forwardWebbingGadget.markovEdge(
        webbingAddress,
        gammaForward
      );
      recordTransitionProbability(edge);
    }

    const mintTransitionProbabilities = new Map();
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
        mintTransitionProbabilities.set(address, weight / totalNodeWeight);
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
      const owner = _scoringAddressToId.get(address);
      if (owner == null) {
        return address;
      }
      const epochEndIndex = sortedIndex(epochStarts, edgeTimestampMs);
      const epochStartIndex = epochEndIndex - 1;
      const epochTimestampMs = epochStarts[epochStartIndex];
      return epochGadget.toRaw({
        owner,
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
      const totalOutPr = NodeAddress.hasPrefix(src, epochGadget.prefix)
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

    function* realAndVirtualNodes(): Iterator<MarkovNode> {
      yield* _nodes.values();
      for (const nodeAddress of virtualizedNodeAddresses(
        epochStarts,
        participants
      )) {
        yield NullUtil.get(virtualizedNode(nodeAddress));
      }
    }

    const radiationTransitionProbabilities = [...realAndVirtualNodes()].map(
      (node) => {
        return 1 - NullUtil.orElse(_nodeOutMasses.get(node.address), 0);
      }
    );

    return new MarkovProcessGraph(
      _nodes,
      _edges,
      participants,
      epochStarts,
      lastEpochEndMs,
      parameters,
      mintTransitionProbabilities,
      radiationTransitionProbabilities,
      indexedPersonalAttributions
    );
  }

  epochStarts(): $ReadOnlyArray<number> {
    return this._epochStarts;
  }

  intervals(): IntervalSequence {
    const es = this._epochStarts;
    const intervals = [];
    for (let i = 0; i < es.length; i++) {
      const startTimeMs = es[i];
      const endTimeMs = i + 1 < es.length ? es[i + 1] : this._lastEpochEndMs;
      intervals.push({startTimeMs, endTimeMs});
    }
    return intervalSequence(intervals);
  }

  participants(): $ReadOnlyArray<Participant> {
    return this._participants;
  }

  parameters(): Parameters {
    return this._parameters;
  }

  /**
   * Return the node address's canonical index in the
   * node order, if it is present.
   */
  nodeIndex(address: NodeAddressT): number | null {
    return NullUtil.orElse(this._nodeIndex.get(address), null);
  }

  /**
   * Returns a canonical ordering of the nodes in the graph.
   *
   * No assumptions should be made about the node order, other than
   * that it is stable for any given MarkovProcessGraph.
   */
  *nodeOrder(): Iterator<NodeAddressT> {
    yield* _nodeOrder(this._nodes, this._epochStarts, this._participants);
  }

  node(address: NodeAddressT): MarkovNode | null {
    NodeAddress.assertValid(address);
    return this._nodes.get(address) || virtualizedNode(address);
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
    for (const address of virtualizedNodeAddresses(
      this._epochStarts,
      this._participants
    )) {
      if (NodeAddress.hasPrefix(address, prefix)) {
        yield NullUtil.get(virtualizedNode(address));
      }
    }
  }

  /**
   * Return the edge address's canonical index in the
   * edge order, if it is present.
   */
  edgeIndex(address: MarkovEdgeAddressT): number | null {
    return NullUtil.orElse(this._edgeIndex.get(address), null);
  }

  /**
   * Returns a canonical ordering of the edges in the graph.
   *
   * No assumptions should be made about the edge order, other than
   * that it is stable for any given MarkovProcessGraph.
   */
  *edgeOrder(): Iterator<MarkovEdgeAddressT> {
    yield* this._edges.keys();
    yield* virtualizedMarkovEdgeAddresses(
      this._epochStarts,
      this._participants,
      this._mintTransitionProbabilties,
      this.nodeOrder(),
      this._indexedPersonalAttributions
    );
  }

  edge(address: MarkovEdgeAddressT): MarkovEdge | null {
    MarkovEdgeAddress.assertValid(address);
    return (
      this._edges.get(address) ||
      virtualizedMarkovEdge(
        address,
        this._parameters,
        this._nodeIndex,
        this._mintTransitionProbabilties,
        this._radiationTransitionProbabilties,
        this._indexedPersonalAttributions
      )
    );
  }

  /**
   * Iterate over the edges in the graph.
   *
   * The edges are always iterated over in the edge order.
   */
  *edges(): Iterator<MarkovEdge> {
    yield* this._edges.values();
    for (const addr of virtualizedMarkovEdgeAddresses(
      this._epochStarts,
      this._participants,
      this._mintTransitionProbabilties,
      this.nodeOrder(),
      this._indexedPersonalAttributions
    )) {
      yield NullUtil.get(
        virtualizedMarkovEdge(
          addr,
          this._parameters,
          this._nodeIndex,
          this._mintTransitionProbabilties,
          this._radiationTransitionProbabilties,
          this._indexedPersonalAttributions
        )
      );
    }
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
        const srcIndex = this.nodeIndex(e.src);
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
    const indexedEdges = Array.from(this._edges.values()).map((e) => ({
      address: e.address,
      reversed: e.reversed,
      src: NullUtil.get(this.nodeIndex(e.src)),
      dst: NullUtil.get(this.nodeIndex(e.dst)),
      transitionProbability: e.transitionProbability,
    }));
    const indexedMints = Array.from(
      this._mintTransitionProbabilties
    ).map(([addr, pr]) => [NullUtil.get(this.nodeIndex(addr)), pr]);
    return {
      nodes: [...this._nodes.values()],
      indexedEdges,
      participants: this._participants,
      epochStarts: this._epochStarts,
      lastEpochEndMs: this._lastEpochEndMs,
      parameters: this._parameters,
      radiationTransitionProbabilities: this._radiationTransitionProbabilties,
      indexedMints,
      personalAttributions: this._indexedPersonalAttributions.toPersonalAttributions(),
    };
  }

  static fromJSON(j: MarkovProcessGraphJSON): MarkovProcessGraph {
    const {
      nodes,
      indexedEdges,
      participants,
      epochStarts,
      lastEpochEndMs,
      parameters,
      radiationTransitionProbabilities,
      indexedMints,
      personalAttributions,
    } = j;
    const nodeOrder = [
      ...nodes.map((n) => n.address),
      ...virtualizedNodeAddresses(epochStarts, participants),
    ];
    const edges = indexedEdges.map((e) => ({
      address: e.address,
      reversed: e.reversed,
      src: nodeOrder[e.src],
      dst: nodeOrder[e.dst],
      transitionProbability: e.transitionProbability,
    }));
    const mintTransitionProbabilities = new Map(
      indexedMints.map(([i, pr]) => [nodeOrder[i], pr])
    );
    const indexedPersonalAttributions = new IndexedPersonalAttributions(
      personalAttributions,
      epochStarts
    );

    return new MarkovProcessGraph(
      new Map(nodes.map((n) => [n.address, n])),
      new Map(edges.map((e) => [markovEdgeAddressFromMarkovEdge(e), e])),
      participants,
      epochStarts,
      lastEpochEndMs,
      parameters,
      mintTransitionProbabilities,
      radiationTransitionProbabilities,
      indexedPersonalAttributions
    );
  }
}

/**
 * Yield the canonical node order.
 * This has been separated from the class because we need it at construction time, etc.
 */
function* _nodeOrder(
  nodes: $ReadOnlyMap<NodeAddressT, MarkovNode>,
  epochStarts: $ReadOnlyArray<TimestampMs>,
  participants: $ReadOnlyArray<Participant>
): Iterable<NodeAddressT> {
  yield* nodes.keys();
  yield* virtualizedNodeAddresses(epochStarts, participants);
}

/**
 * Return an array containing the node addresses for every
 * virtualized node. The order must be stable.
 */
function* virtualizedNodeAddresses(
  epochStarts: $ReadOnlyArray<TimestampMs>,
  participants: $ReadOnlyArray<Participant>
): Iterable<NodeAddressT> {
  yield seedGadget.prefix;
  for (const epochStart of epochStarts) {
    yield accumulatorGadget.toRaw({epochStart});
    for (const {id} of participants) {
      yield epochGadget.toRaw({owner: id, epochStart});
    }
  }
}

function virtualizedNode(address: NodeAddressT): MarkovNode | null {
  // Perf tweak: Check the most common node types first, and rarest
  // last.
  if (NodeAddress.hasPrefix(address, epochGadget.prefix)) {
    return epochGadget.node(epochGadget.fromRaw(address));
  }
  if (NodeAddress.hasPrefix(address, accumulatorGadget.prefix)) {
    return accumulatorGadget.node(accumulatorGadget.fromRaw(address));
  }
  if (NodeAddress.hasPrefix(address, seedGadget.prefix)) {
    return seedGadget.node();
  }
  return null;
}

function* virtualizedMarkovEdgeAddresses(
  epochStarts: $ReadOnlyArray<TimestampMs>,
  participants: $ReadOnlyArray<Participant>,
  mintTransitionProbabilities: $ReadOnlyMap<NodeAddressT, number>,
  nodeOrder: Iterable<NodeAddressT>,
  indexedPersonalAttributions: IndexedPersonalAttributions
): Iterable<MarkovEdgeAddressT> {
  let lastStart = null;
  for (const epochStart of epochStarts) {
    for (const {id} of participants) {
      yield payoutGadget.toRaw({owner: id, epochStart});
      for (const toParticipantId of indexedPersonalAttributions.recipientsForEpochAndParticipant(
        epochStart,
        id
      )) {
        yield personalAttributionGadget.toRaw({
          epochStart,
          fromParticipantId: id,
          toParticipantId,
        });
      }
      if (lastStart != null) {
        const webbingAddress = {thisStart: epochStart, lastStart, owner: id};
        yield forwardWebbingGadget.toRaw(webbingAddress);
        yield backwardWebbingGadget.toRaw(webbingAddress);
      } else {
        const webbingAddress = {
          thisStart: epochStart,
          lastStart: epochStart,
          owner: id,
        };
        yield backwardWebbingGadget.toRaw(webbingAddress);
      }
    }
    lastStart = epochStart;
  }
  if (lastStart == null) {
    // Needed to satisfy flow when adding the final "forward" webbing edges (which are loops).
    throw new Error(`invariant violation: there were no epochs`);
  }
  for (const {id} of participants) {
    const webbingAddress = {thisStart: lastStart, lastStart, owner: id};
    yield forwardWebbingGadget.toRaw(webbingAddress);
  }
  for (const addr of mintTransitionProbabilities.keys()) {
    yield seedMintGadget.toRaw(addr);
  }
  for (const addr of nodeOrder) {
    if (addr === seedGadget.prefix) {
      continue;
    }
    yield radiationGadget.toRaw(addr);
  }
}

function virtualizedMarkovEdge(
  address: MarkovEdgeAddressT,
  parameters: Parameters,
  nodeIndex: $ReadOnlyMap<NodeAddressT, number>,
  mintTransitionProbabilities: $ReadOnlyMap<NodeAddressT, number>,
  radiationTransitionProbabilities: $ReadOnlyArray<number>,
  indexedPersonalAttributions: IndexedPersonalAttributions
): MarkovEdge | null {
  if (MarkovEdgeAddress.hasPrefix(address, radiationGadget.prefix)) {
    const nodeAddress = radiationGadget.fromRaw(address);
    const index = NullUtil.get(nodeIndex.get(nodeAddress));
    const probability = radiationTransitionProbabilities[index];
    return radiationGadget.markovEdge(nodeAddress, probability);
  }
  if (MarkovEdgeAddress.hasPrefix(address, seedMintGadget.prefix)) {
    const nodeAddress = seedMintGadget.fromRaw(address);
    const probability = NullUtil.get(
      mintTransitionProbabilities.get(nodeAddress)
    );
    return seedMintGadget.markovEdge(nodeAddress, probability);
  }
  if (MarkovEdgeAddress.hasPrefix(address, payoutGadget.prefix)) {
    const payoutAddress = payoutGadget.fromRaw(address);
    const sumOfPersonalAttributions =
      indexedPersonalAttributions.getSumProportionValue(
        payoutAddress.epochStart,
        payoutAddress.owner
      ) || 0;
    return payoutGadget.markovEdge(
      payoutGadget.fromRaw(address),
      parameters.beta - sumOfPersonalAttributions * parameters.beta
    );
  }
  if (MarkovEdgeAddress.hasPrefix(address, forwardWebbingGadget.prefix)) {
    return forwardWebbingGadget.markovEdge(
      forwardWebbingGadget.fromRaw(address),
      parameters.gammaForward
    );
  }
  if (MarkovEdgeAddress.hasPrefix(address, backwardWebbingGadget.prefix)) {
    return backwardWebbingGadget.markovEdge(
      backwardWebbingGadget.fromRaw(address),
      parameters.gammaBackward
    );
  }
  if (MarkovEdgeAddress.hasPrefix(address, personalAttributionGadget.prefix)) {
    const personalAttributionAddress = personalAttributionGadget.fromRaw(
      address
    );
    const proportionValue =
      indexedPersonalAttributions.getProportionValue(
        personalAttributionAddress.epochStart,
        personalAttributionAddress.fromParticipantId,
        personalAttributionAddress.toParticipantId
      ) || 0;
    return personalAttributionGadget.markovEdge(
      personalAttributionGadget.fromRaw(address),
      parameters.beta * proportionValue
    );
  }
  return null;
}

export const jsonParser: C.Parser<MarkovProcessGraphJSON> = C.object({
  nodes: C.array(markovNodeParser),
  indexedEdges: C.array(indexedEdgeParser),
  participants: C.array(participantParser),
  epochStarts: C.array(C.number),
  lastEpochEndMs: C.number,
  parameters: parametersParser,
  radiationTransitionProbabilities: C.array(C.number),
  indexedMints: C.array(C.tuple([C.number, C.number])),
  personalAttributions: personalAttributionsParser,
});

export const parser: C.Parser<MarkovProcessGraph> = C.fmap(
  jsonParser,
  MarkovProcessGraph.fromJSON
);
