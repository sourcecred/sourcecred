//@flow

import {type WeightedGraph} from "../core/weightedGraph";
import {TaskReporter} from "../util/taskReporter";
import {type TimelineCredParameters} from "../analysis/timeline/params";
import {type PluginDeclaration} from "../analysis/pluginDeclaration";
import {TimelineCred} from "../analysis/timeline/timelineCred";
import {type OutputV2} from "../analysis/output";

/**
 * An abstract handle for TimelineCred.compute-like functions.
 */
export type ComputeFunction = (
  opts: ComputeOpts
) => Promise<{|+timelineCred: TimelineCred, +output: OutputV2|}>;

// Note: type should allow extra properties, it's expected to be a subset.
type ComputeEnv = {
  +reporter: TaskReporter,
};

type ComputeOpts = {|
  weightedGraph: WeightedGraph,
  params?: $Shape<TimelineCredParameters>,
  // TODO(@decentralion, #1557): remove plugins arg
  plugins: $ReadOnlyArray<PluginDeclaration>,
|};

export async function computeTask(
  compute: ComputeFunction,
  {reporter}: ComputeEnv,
  opts: ComputeOpts
): Promise<{|+timelineCred: TimelineCred, +output: OutputV2|}> {
  reporter.start("compute-cred");
  const cred = await compute(opts);
  reporter.finish("compute-cred");
  return cred;
}
