//@flow

import {type NodeAddressT} from "../core/graph";
import {type WeightedGraph} from "../core/weightedGraph";
import {TaskReporter} from "../util/taskReporter";
import {type TimelineCredParameters} from "../analysis/timeline/params";
import {TimelineCred} from "../analysis/timeline/timelineCred";

/**
 * An abstract handle for TimelineCred.compute-like functions.
 */
export type ComputeFunction = (opts: ComputeOpts) => Promise<TimelineCred>;

// Note: type should allow extra properties, it's expected to be a subset.
type ComputeEnv = {
  +reporter: TaskReporter,
};

type ComputeOpts = {|
  weightedGraph: WeightedGraph,
  params?: $Shape<TimelineCredParameters>,
  // Which node addresses will be considered "scoring" for cred
  // calculation purposes.
  scoringNodePrefixes: $ReadOnlyArray<NodeAddressT>,
|};

export async function computeTask(
  compute: ComputeFunction,
  {reporter}: ComputeEnv,
  opts: ComputeOpts
): Promise<TimelineCred> {
  reporter.start("compute-cred");
  const cred = await compute(opts);
  reporter.finish("compute-cred");
  return cred;
}
