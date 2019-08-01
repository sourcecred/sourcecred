// @flow

import {toCompat, fromCompat, type Compatible} from "../../util/compat";
import {type Interval} from "./interval";
import {timelinePagerank} from "./timelinePagerank";
import {distributionToCred} from "./distributionToCred";
import {
  Graph,
  type GraphJSON,
  type NodeAddressT,
  type Node,
} from "../../core/graph";
import {
  type Weights,
  type WeightsJSON,
  toJSON as weightsToJSON,
  fromJSON as weightsFromJSON,
} from "../weights";
import {type NodeAndEdgeTypes} from "../types";
import {
  filterTimelineCred,
  type FilteredTimelineCred,
  filteredTimelineCredToJSON,
  filteredTimelineCredFromJSON,
  type FilteredTimelineCredJSON,
} from "./filterTimelineCred";

export type {Interval} from "./interval";

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
  // To save on space, we keep cred only for nodes matching one of these
  // NodeAddresses.
  +filterNodePrefixes: $ReadOnlyArray<NodeAddressT>,
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
  _cred: FilteredTimelineCred;
  _params: TimelineCredParameters;
  _config: TimelineCredConfig;

  constructor(
    graph: Graph,
    cred: FilteredTimelineCred,
    params: TimelineCredParameters,
    config: TimelineCredConfig
  ) {
    this._graph = graph;
    this._cred = cred;
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

  availableNodes(): NodeAddressT[] {
    return Array.from(this._cred.addressToCred.keys());
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
    return this._cred.intervals;
  }

  toJSON(): TimelineCredJSON {
    const rawJSON = {
      graphJSON: this._graph.toJSON(),
      credJSON: filteredTimelineCredToJSON(this._cred),
      paramsJSON: paramsToJSON(this._params),
    };
    return toCompat(COMPAT_INFO, rawJSON);
  }

  static fromJSON(
    j: TimelineCredJSON,
    config: TimelineCredConfig
  ): TimelineCred {
    const json = fromCompat(COMPAT_INFO, j);
    const {graphJSON, credJSON, paramsJSON} = json;
    const graph = Graph.fromJSON(graphJSON);
    const cred = filteredTimelineCredFromJSON(credJSON);
    const params = paramsFromJSON(paramsJSON);
    return new TimelineCred(graph, cred, params, config);
  }

  static async compute(
    graph: Graph,
    params: TimelineCredParameters,
    config: TimelineCredConfig
  ): Promise<TimelineCred> {
    const ftc = await _computeTimelineCred(graph, params, config);
    return new TimelineCred(graph, ftc, params, config);
  }

  /**
   * Returns the Node matching a given NodeAddressT, if such a node exists,
   * or undefined otherwise.
   */
  node(a: NodeAddressT): ?Node {
    return this.graph().node(a);
  }

  /**
   * Returns an array of cred from a given NodeAddressT from FilteredTimelineCred,
   * if such a node exists, or undefined otherwise.
   */
  cred(a: NodeAddressT): ?$ReadOnlyArray<number> {
    return this._cred.addressToCred.get(a);
  }
}

async function _computeTimelineCred(
  graph: Graph,
  params: TimelineCredParameters,
  config: TimelineCredConfig
): Promise<FilteredTimelineCred> {
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
  const filtered = filterTimelineCred(
    cred,
    nodeOrder,
    config.filterNodePrefixes
  );
  return filtered;
}

const COMPAT_INFO = {type: "sourcecred/timelineCred", version: "0.1.0"};

export opaque type TimelineCredJSON = Compatible<{|
  +graphJSON: GraphJSON,
  +paramsJSON: ParamsJSON,
  +credJSON: FilteredTimelineCredJSON,
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
