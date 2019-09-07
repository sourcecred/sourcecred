// @flow

import {sum} from "d3-array";
import sortBy from "lodash.sortby";
import * as NullUtil from "../../util/null";
import * as MapUtil from "../../util/map";
import {toCompat, fromCompat, type Compatible} from "../../util/compat";
import {type Interval} from "./interval";
import {timelinePagerank} from "./timelinePagerank";
import {distributionToCred} from "./distributionToCred";
import {
  Graph,
  type GraphJSON,
  type NodeAddressT,
  NodeAddress,
  type Node,
} from "../../core/graph";
import {
  type Weights,
  type WeightsJSON,
  toJSON as weightsToJSON,
  fromJSON as weightsFromJSON,
} from "../weights";
import {type NodeAndEdgeTypes} from "../types";

export type {Interval} from "./interval";

/**
 * A Graph Node wrapped with cred information.
 */
export type CredNode = {|
  // The Graph Node in question
  +node: Node,
  // The total aggregated cred. (Summed across every interval).
  +total: number,
  // The timeline sequence of cred (one score per interval).
  +cred: $ReadOnlyArray<number>,
|};

/**
 * Parameters for computing TimelineCred
 *
 * The parameters are intended to be user-configurable.
 */
export type TimelineCredParameters = {|
  // Determines how quickly cred returns to the PageRank seed vector. If alpha
  // is high, then cred will tend to "stick" to nodes that are seeded, e.g.
  // issues and pull requests. Alpha should be between 0 and 1.
  +alpha: number,
  // Determines how quickly cred decays. The decay is 1, then cred never
  // decays, and old nodes and edges will retain full weight forever. (This
  // would result in cred that is highly biased towards old contributions, as
  // they would continue earning cred in every timeslice, forever.) If the
  // decay is 0, then weights go to zero the first week after their node/edge
  // was created. Should be between 0 and 1.
  +intervalDecay: number,
  // The weights. This determines how much cred is assigned based on different
  // node types, how cred flows across various edge types, and can specify
  // manual weights directly on individual nodes. See the docs in
  // `analysis/weights` for details.
  +weights: Weights,
|};

/**
 * Configuration for computing TimelineCred
 *
 * Unlike the parameters, the config is expected to be static.
 * It's code-level config that isolates the TimelineCred algorithms from
 * specific plugin-level details about which nodes addresses are used for scoring,
 * etc.
 *
 * A default config is available in `src/plugins/defaultCredConfig`
 */
export type TimelineCredConfig = {|
  // Cred is normalized so that for a given interval, the total score of all
  // nodes matching this prefix will be equal to the total weight of nodes in
  // the interval.
  +scoreNodePrefix: NodeAddressT,
  // The types are used to assign base cred to nodes based on their type. Node
  // that the weight for each type may be overriden in the params.
  +types: NodeAndEdgeTypes,
|};

/**
 * Represents the timeline cred of a graph. This class wraps all the data
 * needed to analyze and interpet cred (ie. it has the Graph and the cred
 * scores), and provides convenient view methods for accessing the cred.
 *
 * The TimelineCred also has the params and config. The intention is that this
 * is a "one stop shop" for serializing SourceCred results.
 */
export class TimelineCred {
  _graph: Graph;
  _intervals: $ReadOnlyArray<Interval>;
  _addressToCred: Map<NodeAddressT, $ReadOnlyArray<number>>;
  _params: TimelineCredParameters;
  _config: TimelineCredConfig;

  constructor(
    graph: Graph,
    intervals: $ReadOnlyArray<Interval>,
    addressToCred: Map<NodeAddressT, $ReadOnlyArray<number>>,
    params: TimelineCredParameters,
    config: TimelineCredConfig
  ) {
    this._graph = graph;
    this._intervals = intervals;
    this._addressToCred = addressToCred;
    this._params = params;
    this._config = config;
  }

  graph(): Graph {
    return this._graph;
  }

  params(): TimelineCredParameters {
    return this._params;
  }

  config(): TimelineCredConfig {
    return this._config;
  }

  /**
   * Creates a new TimelineCred based on the new Parameters.
   * Holds the graph and config constant.
   *
   * This returns a new TimelineCred; it does not modify the existing one.
   */
  async reanalyze(newParams: TimelineCredParameters): Promise<TimelineCred> {
    return await TimelineCred.compute(this._graph, newParams, this._config);
  }

  /**
   * Return all the intervals in the timeline.
   */
  intervals(): $ReadOnlyArray<Interval> {
    return this._intervals;
  }

  /**
   * Get the CredNode for a given NodeAddress.
   *
   * Returns undefined if the node is not in the filtered results.
   *
   * Note that it's possible that the node is present in the Graph, but not the
   * filtered results; if so, it will return undefined.
   */
  credNode(a: NodeAddressT): ?CredNode {
    const cred = this._addressToCred.get(a);
    if (cred === undefined) {
      return undefined;
    }
    const total = sum(cred);
    const node = NullUtil.get(this._graph.node(a));
    return {cred, total, node};
  }

  /**
   * Return all the nodes matching the prefix, along with their cred,
   * sorted by total cred (descending).
   */
  credSortedNodes(prefix: NodeAddressT): $ReadOnlyArray<CredNode> {
    const match = (a) => NodeAddress.hasPrefix(a, prefix);
    const addresses = Array.from(this._addressToCred.keys()).filter(match);
    const credNodes = addresses.map((a) => this.credNode(a));
    return sortBy(credNodes, (x: CredNode) => -x.total);
  }

  /**
   * Create a new, filtered TimelineCred, by removing low-scored nodes.
   *
   * Cred Graphs may have a huge number of small contributions, like comments,
   * in which end users are not particularly interested. However, the size of
   * the TimelineCred offered to the frontend matters quite a bit. Therefore,
   * we can use this method to discard almost all nodes in the graph.
   *
   * Specifically, `reduceSize` takes in an array of inclusion prefixes: for
   * each inclusion prefix, we will take the top `k` nodes matching that prefix
   * (by total score across all intervals).
   *
   * It also takes `fullInclusion` prefixes: for these prefixes, every matching
   * node will be included. This allows us to ensure that e.g. every user will
   * be included in the `cli scores` output, even if they are not in the top
   * `k` users.
   */
  reduceSize(opts: {|
    +typePrefixes: $ReadOnlyArray<NodeAddressT>,
    +nodesPerType: number,
    +fullInclusionPrefixes: $ReadOnlyArray<NodeAddressT>,
  |}): TimelineCred {
    const {typePrefixes, nodesPerType, fullInclusionPrefixes} = opts;
    const selectedNodes: Set<NodeAddressT> = new Set();
    for (const prefix of typePrefixes) {
      const matchingNodes = this.credSortedNodes(prefix).slice(0, nodesPerType);
      for (const {node} of matchingNodes) {
        selectedNodes.add(node.address);
      }
    }
    // For the fullInclusionPrefixes, we won't slice -- we just take every match.
    for (const prefix of fullInclusionPrefixes) {
      const matchingNodes = this.credSortedNodes(prefix);
      for (const {node} of matchingNodes) {
        selectedNodes.add(node.address);
      }
    }

    const filteredAddressToCred = new Map();
    for (const address of selectedNodes) {
      const cred = NullUtil.get(this._addressToCred.get(address));
      filteredAddressToCred.set(address, cred);
    }
    return new TimelineCred(
      this._graph,
      this._intervals,
      filteredAddressToCred,
      this._params,
      this._config
    );
  }

  toJSON(): TimelineCredJSON {
    const rawJSON = {
      graphJSON: this._graph.toJSON(),
      intervalsJSON: this._intervals,
      credJSON: MapUtil.toObject(this._addressToCred),
      paramsJSON: paramsToJSON(this._params),
      configJSON: this._config,
    };
    return toCompat(COMPAT_INFO, rawJSON);
  }

  static fromJSON(j: TimelineCredJSON): TimelineCred {
    const json = fromCompat(COMPAT_INFO, j);
    const {graphJSON, intervalsJSON, credJSON, paramsJSON, configJSON} = json;
    const cred = MapUtil.fromObject(credJSON);
    const graph = Graph.fromJSON(graphJSON);
    const params = paramsFromJSON(paramsJSON);
    return new TimelineCred(graph, intervalsJSON, cred, params, configJSON);
  }

  static async compute(
    graph: Graph,
    params: TimelineCredParameters,
    config: TimelineCredConfig
  ): Promise<TimelineCred> {
    const nodeOrder = Array.from(graph.nodes()).map((x) => x.address);
    const distribution = await timelinePagerank(
      graph,
      config.types,
      params.weights,
      params.intervalDecay,
      params.alpha
    );
    const cred = distributionToCred(
      distribution,
      nodeOrder,
      config.scoreNodePrefix
    );
    const addressToCred = new Map();
    for (let i = 0; i < nodeOrder.length; i++) {
      const addr = nodeOrder[i];
      const addrCred = cred.map(({cred}) => cred[i]);
      addressToCred.set(addr, addrCred);
    }
    const intervals = cred.map((x) => x.interval);
    const preliminaryCred = new TimelineCred(
      graph,
      intervals,
      addressToCred,
      params,
      config
    );
    return preliminaryCred.reduceSize({
      typePrefixes: config.types.nodeTypes.map((x) => x.prefix),
      nodesPerType: 100,
      fullInclusionPrefixes: [config.scoreNodePrefix],
    });
  }
}

const COMPAT_INFO = {type: "sourcecred/timelineCred", version: "0.3.0"};

export opaque type TimelineCredJSON = Compatible<{|
  +graphJSON: GraphJSON,
  +paramsJSON: ParamsJSON,
  +configJSON: TimelineCredConfig,
  +credJSON: {[string]: $ReadOnlyArray<number>},
  +intervalsJSON: $ReadOnlyArray<Interval>,
|}>;

type ParamsJSON = {|
  +alpha: number,
  +intervalDecay: number,
  +weights: WeightsJSON,
|};

function paramsToJSON(p: TimelineCredParameters): ParamsJSON {
  return {
    alpha: p.alpha,
    intervalDecay: p.intervalDecay,
    weights: weightsToJSON(p.weights),
  };
}

function paramsFromJSON(p: ParamsJSON): TimelineCredParameters {
  return {
    alpha: p.alpha,
    intervalDecay: p.intervalDecay,
    weights: weightsFromJSON(p.weights),
  };
}
