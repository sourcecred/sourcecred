// @flow

import {sum} from "d3-array";
import sortBy from "lodash.sortby";
import * as NullUtil from "../../util/null";
import * as MapUtil from "../../util/map";
import {toCompat, fromCompat, type Compatible} from "../../util/compat";
import {type Interval} from "../../core/interval";
import {timelinePagerank} from "../../core/algorithm/timelinePagerank";
import {distributionToCred} from "../../core/algorithm/distributionToCred";
import {type PluginDeclaration} from "../pluginDeclaration";
import {type NodeAddressT, NodeAddress, type Node} from "../../core/graph";
import * as WeightedGraph from "../../core/weightedGraph";
import {type Weights as WeightsT} from "../../core/weights";
import type {
  WeightedGraph as WeightedGraphT,
  WeightedGraphJSON,
} from "../../core/weightedGraph";
import {
  type TimelineCredParameters,
  paramsToJSON,
  paramsFromJSON,
  type TimelineCredParametersJSON,
  partialParams,
  defaultParams,
} from "./params";

export type {Interval} from "../../core/interval";

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
 * needed to analyze and interpet cred (ie. it has the WeightedGraph and the cred
 * scores), and provides convenient view methods for accessing the cred.
 *
 * The TimelineCred also has the params and config. The intention is that this
 * is a "one stop shop" for serializing SourceCred results.
 */
export class TimelineCred {
  _weightedGraph: WeightedGraphT;
  _intervals: $ReadOnlyArray<Interval>;
  _addressToCred: Map<NodeAddressT, $ReadOnlyArray<number>>;
  _params: TimelineCredParameters;
  _plugins: $ReadOnlyArray<PluginDeclaration>;

  constructor(
    graph: WeightedGraphT,
    intervals: $ReadOnlyArray<Interval>,
    addressToCred: Map<NodeAddressT, $ReadOnlyArray<number>>,
    params: TimelineCredParameters,
    plugins: $ReadOnlyArray<PluginDeclaration>
  ) {
    this._weightedGraph = graph;
    this._intervals = intervals;
    this._addressToCred = addressToCred;
    this._params = params;
    this._plugins = plugins;
  }

  weightedGraph(): WeightedGraphT {
    return this._weightedGraph;
  }

  params(): TimelineCredParameters {
    return this._params;
  }

  /**
   * Creates a new TimelineCred based on the new Parameters.
   * Holds the graph and config constant.
   *
   * This returns a new TimelineCred; it does not modify the existing one.
   */
  async reanalyze(
    newWeights: WeightsT,
    newParams: $Shape<TimelineCredParameters>
  ): Promise<TimelineCred> {
    return await TimelineCred.compute({
      weightedGraph: WeightedGraph.overrideWeights(
        this._weightedGraph,
        newWeights
      ),
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
    const node = NullUtil.get(this._weightedGraph.graph.node(a));
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
    const userTypes = [].concat(...this._plugins.map((p) => p.userTypes));
    return this.credSortedNodes(userTypes.map((x) => x.prefix));
  }

  toJSON(): TimelineCredJSON {
    const rawJSON = {
      weightedGraphJSON: WeightedGraph.toJSON(this._weightedGraph),
      intervalsJSON: this._intervals,
      credJSON: MapUtil.toObject(this._addressToCred),
      paramsJSON: paramsToJSON(this._params),
      pluginsJSON: this._plugins,
    };
    return toCompat(COMPAT_INFO, rawJSON);
  }

  static fromJSON(j: TimelineCredJSON): TimelineCred {
    const json = fromCompat(COMPAT_INFO, j);
    const {
      weightedGraphJSON,
      intervalsJSON,
      credJSON,
      paramsJSON,
      pluginsJSON,
    } = json;
    const cred = MapUtil.fromObject(credJSON);
    const weightedGraph = WeightedGraph.fromJSON(weightedGraphJSON);
    const params = paramsFromJSON(paramsJSON);
    return new TimelineCred(
      weightedGraph,
      intervalsJSON,
      cred,
      params,
      pluginsJSON
    );
  }

  static async compute(opts: {|
    weightedGraph: WeightedGraphT,
    params?: $Shape<TimelineCredParameters>,
    plugins: $ReadOnlyArray<PluginDeclaration>,
  |}): Promise<TimelineCred> {
    const {weightedGraph, params, plugins} = opts;
    const {graph} = weightedGraph;
    const fullParams = params == null ? defaultParams() : partialParams(params);
    const nodeOrder = Array.from(graph.nodes()).map((x) => x.address);
    const userTypes = [].concat(...plugins.map((x) => x.userTypes));
    const scorePrefixes = userTypes.map((x) => x.prefix);
    const distribution = await timelinePagerank(
      weightedGraph,
      fullParams.intervalDecay,
      fullParams.alpha
    );
    const cred = distributionToCred(distribution, nodeOrder, scorePrefixes);
    const addressToCred = new Map();
    for (let i = 0; i < nodeOrder.length; i++) {
      const addr = nodeOrder[i];
      const addrCred = cred.map(({cred}) => cred[i]);
      addressToCred.set(addr, addrCred);
    }
    const intervals = cred.map((x) => x.interval);
    return new TimelineCred(
      weightedGraph,
      intervals,
      addressToCred,
      fullParams,
      plugins
    );
  }
}

const COMPAT_INFO = {type: "sourcecred/timelineCred", version: "0.6.0"};

export opaque type TimelineCredJSON = Compatible<{|
  +weightedGraphJSON: WeightedGraphJSON,
  +paramsJSON: TimelineCredParametersJSON,
  +pluginsJSON: $ReadOnlyArray<PluginDeclaration>,
  +credJSON: {[string]: $ReadOnlyArray<number>},
  +intervalsJSON: $ReadOnlyArray<Interval>,
|}>;
