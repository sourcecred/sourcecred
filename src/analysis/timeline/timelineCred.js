// @flow

import {sum} from "d3-array";
import sortBy from "lodash.sortby";
import * as NullUtil from "../../util/null";
import * as MapUtil from "../../util/map";
import {toCompat, fromCompat, type Compatible} from "../../util/compat";
import {type Interval} from "./interval";
import {timelinePagerank} from "./timelinePagerank";
import {distributionToCred} from "./distributionToCred";
import {type PluginDeclaration, combineTypes} from "../pluginDeclaration";
import {
  Graph,
  type GraphJSON,
  type NodeAddressT,
  NodeAddress,
  type Node,
} from "../../core/graph";
import {
  type TimelineCredParameters,
  paramsToJSON,
  paramsFromJSON,
  type TimelineCredParametersJSON,
  type PartialTimelineCredParameters,
  partialParams,
  defaultParams,
} from "./params";

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
  _plugins: $ReadOnlyArray<PluginDeclaration>;

  constructor(
    graph: Graph,
    intervals: $ReadOnlyArray<Interval>,
    addressToCred: Map<NodeAddressT, $ReadOnlyArray<number>>,
    params: TimelineCredParameters,
    plugins: $ReadOnlyArray<PluginDeclaration>
  ) {
    this._graph = graph;
    this._intervals = intervals;
    this._addressToCred = addressToCred;
    this._params = params;
    this._plugins = plugins;
  }

  graph(): Graph {
    return this._graph;
  }

  params(): TimelineCredParameters {
    return this._params;
  }

  plugins(): $ReadOnlyArray<PluginDeclaration> {
    return this._plugins;
  }

  /**
   * Creates a new TimelineCred based on the new Parameters.
   * Holds the graph and config constant.
   *
   * This returns a new TimelineCred; it does not modify the existing one.
   */
  async reanalyze(
    newParams: PartialTimelineCredParameters
  ): Promise<TimelineCred> {
    return await TimelineCred.compute({
      graph: this._graph,
      params: newParams,
      plugins: this._plugins,
    });
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
   * Returns nodes sorted by their total cred (descending).
   *
   * If prefixes is provided, then only nodes matching at least one of the provided
   * address prefixes will be included.
   */
  credSortedNodes(
    prefixes?: $ReadOnlyArray<NodeAddressT>
  ): $ReadOnlyArray<CredNode> {
    let addresses = Array.from(this._addressToCred.keys());

    if (prefixes != null) {
      const match = (a) => prefixes.some((p) => NodeAddress.hasPrefix(a, p));
      addresses = addresses.filter(match);
    }
    const credNodes = addresses.map((a) => this.credNode(a));
    return sortBy(credNodes, (x: CredNode) => -x.total);
  }

  /**
   * Returns all user-typed nodes, sorted by their total cred (descending).
   *
   * A node is considered a user-type node if its address has a prefix match
   * with a type specified as a user type by one of the plugin declarations.
   */
  userNodes(): $ReadOnlyArray<CredNode> {
    const userTypes = [].concat(...this.plugins().map((p) => p.userTypes));
    return this.credSortedNodes(userTypes.map((x) => x.prefix));
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
      const matchingNodes = this.credSortedNodes([prefix]).slice(
        0,
        nodesPerType
      );
      for (const {node} of matchingNodes) {
        selectedNodes.add(node.address);
      }
    }
    // For the fullInclusionPrefixes, we won't slice -- we just take every match.
    const matchingNodes = this.credSortedNodes(fullInclusionPrefixes);
    for (const {node} of matchingNodes) {
      selectedNodes.add(node.address);
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
      this._plugins
    );
  }

  toJSON(): TimelineCredJSON {
    const rawJSON = {
      graphJSON: this._graph.toJSON(),
      intervalsJSON: this._intervals,
      credJSON: MapUtil.toObject(this._addressToCred),
      paramsJSON: paramsToJSON(this._params),
      pluginsJSON: this._plugins,
    };
    return toCompat(COMPAT_INFO, rawJSON);
  }

  static fromJSON(j: TimelineCredJSON): TimelineCred {
    const json = fromCompat(COMPAT_INFO, j);
    const {graphJSON, intervalsJSON, credJSON, paramsJSON, pluginsJSON} = json;
    const cred = MapUtil.fromObject(credJSON);
    const graph = Graph.fromJSON(graphJSON);
    const params = paramsFromJSON(paramsJSON);
    return new TimelineCred(graph, intervalsJSON, cred, params, pluginsJSON);
  }

  static async compute(opts: {|
    graph: Graph,
    params?: PartialTimelineCredParameters,
    plugins: $ReadOnlyArray<PluginDeclaration>,
  |}): Promise<TimelineCred> {
    const {graph, params, plugins} = opts;
    const fullParams = params == null ? defaultParams() : partialParams(params);
    const nodeOrder = Array.from(graph.nodes()).map((x) => x.address);
    const types = combineTypes(plugins);
    const userTypes = [].concat(...plugins.map((x) => x.userTypes));
    const scorePrefixes = userTypes.map((x) => x.prefix);
    const distribution = await timelinePagerank(
      graph,
      types,
      fullParams.weights,
      fullParams.intervalDecay,
      fullParams.alpha
    );
    const cred = distributionToCred(
      distribution,
      nodeOrder,
      userTypes.map((x) => x.prefix)
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
      fullParams,
      plugins
    );
    return preliminaryCred.reduceSize({
      typePrefixes: types.nodeTypes.map((x) => x.prefix),
      nodesPerType: 100,
      fullInclusionPrefixes: scorePrefixes,
    });
  }
}

const COMPAT_INFO = {type: "sourcecred/timelineCred", version: "0.5.0"};

export opaque type TimelineCredJSON = Compatible<{|
  +graphJSON: GraphJSON,
  +paramsJSON: TimelineCredParametersJSON,
  +pluginsJSON: $ReadOnlyArray<PluginDeclaration>,
  +credJSON: {[string]: $ReadOnlyArray<number>},
  +intervalsJSON: $ReadOnlyArray<Interval>,
|}>;
