// @flow

/**
 * This module contains the CredGraph, which is a data structure containing a WeightedGraph,
 * associated TimelineCredScores, and the parameters used to compute those scores.
 * It contains (or will contain) methods for generating CredGraphs, methods for fetching
 * data from them, and methods for analyzing the struture of the cred scores.
 */
import {toCompat, fromCompat, type Compatible} from "../util/compat";
import {type NodeAddressT, NodeAddress} from "./graph";
import {type WeightedGraph as WeightedGraphT} from "./weightedGraph";
import * as WeightedGraph from "./weightedGraph";
import {
  type TimelineCredScores,
  distributionToCred,
  toJSON as timelineCredScoresToJSON,
  fromJSON as timelineCredScoresFromJSON,
  type TimelineCredScoresJSON,
} from "./algorithm/distributionToCred";
import {timelinePagerank} from "./algorithm/timelinePagerank";

/**
 * Represents all the parameters associated with computing cred scores for a
 * WeightedGraph.
 */
export type CredParameters = {|
  +alpha: number,
  +intervalDecay: number,
  +scoringNodePrefixes: $ReadOnlyArray<NodeAddressT>,
|};

/**
 * Represents a weighted graph with computed cred scores.
 *
 * This type contains the WeightedGraph, the TimelineCredScores scores, and the
 * parameters used to compute those scores. It's an opaque type because to be
 * a valid CredGraph, the cred scores must be a faithful computation of cred
 * scores on the included graph, using the included parameters.
 *
 * Clients may freely access the fields; they just can't hand-construct new
 * instances.
 */
export opaque type CredGraph: {|
  +weightedGraph: WeightedGraphT,
  +timelineCredScores: TimelineCredScores,
  +params: CredParameters,
|} = {|
  +weightedGraph: WeightedGraphT,
  +timelineCredScores: TimelineCredScores,
  +params: CredParameters,
|};

/**
 * Given a WeightedGraph and CredParameters, compute a CredGraph.
 *
 * Under the hood, it uses the timelinePagerank module to partition the graph into time
 * intervals and assign a raw score to each one. Then, using the scoringNodePrefixes
 * from the parameters, it converts raw scores to cred scores, ensuring that the total
 * cred minted in each interval is equal to the total node weight for the interval.
 *
 * See the docs on `core/algorithm/timelinePagerank` and
 * `core/algorithm/distributionToCred` for more details.
 */
export async function compute(
  weightedGraph: WeightedGraphT,
  params: CredParameters
): Promise<CredGraph> {
  const nodeOrder = Array.from(weightedGraph.graph.nodes()).map(
    (x) => x.address
  );
  const distribution = await timelinePagerank(
    weightedGraph,
    params.intervalDecay,
    params.alpha
  );
  const timelineCredScores = distributionToCred(
    distribution,
    nodeOrder,
    params.scoringNodePrefixes
  );
  return {weightedGraph, timelineCredScores, params};
}

const COMPAT_INFO = {type: "sourcecred/credGraph", version: "0.1.0"};

export type CredGraphJSON = Compatible<{|
  +weightedGraphJSON: WeightedGraph.WeightedGraphJSON,
  +paramsJSON: CredParametersJSON,
  +timelineCredScoresJSON: TimelineCredScoresJSON,
|}>;

export function toJSON({
  timelineCredScores,
  params,
  weightedGraph,
}: CredGraph): CredGraphJSON {
  return toCompat(COMPAT_INFO, {
    paramsJSON: paramsToJSON(params),
    timelineCredScoresJSON: timelineCredScoresToJSON(timelineCredScores),
    weightedGraphJSON: WeightedGraph.toJSON(weightedGraph),
  });
}

export function fromJSON(j: CredGraphJSON): CredGraph {
  const {timelineCredScoresJSON, paramsJSON, weightedGraphJSON} = fromCompat(
    COMPAT_INFO,
    j
  );
  return {
    timelineCredScores: timelineCredScoresFromJSON(timelineCredScoresJSON),
    params: paramsFromJSON(paramsJSON),
    weightedGraph: WeightedGraph.fromJSON(weightedGraphJSON),
  };
}

type CredParametersJSON = {
  alpha: number,
  intervalDecay: number,
  // Split into address components so we don't have any address separators in
  // the serialized representation.
  scoringNodePrefixes: $ReadOnlyArray<$ReadOnlyArray<string>>,
};

function paramsToJSON({
  intervalDecay,
  alpha,
  scoringNodePrefixes,
}: CredParameters): CredParametersJSON {
  return {
    intervalDecay,
    alpha,
    scoringNodePrefixes: scoringNodePrefixes.map(NodeAddress.toParts),
  };
}

function paramsFromJSON({
  intervalDecay,
  alpha,
  scoringNodePrefixes,
}: CredParametersJSON): CredParameters {
  return {
    intervalDecay,
    alpha,
    scoringNodePrefixes: scoringNodePrefixes.map(NodeAddress.fromParts),
  };
}
