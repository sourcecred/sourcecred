//@flow

import {type WeightedGraph} from "../core/weightedGraph";
import {CredGraph} from "../core/credGraph";
import {TaskReporter} from "../util/taskReporter";
import {type TimelineCredParameters} from "../analysis/timeline/params";
import {type PluginDeclaration} from "../analysis/pluginDeclaration";
import {TimelineCred} from "../analysis/timeline/timelineCred";
import {type Options as CredGraphOptions} from "../core/algorithm/pagerank";

/**
 * An abstract handle for TimelineCred.compute-like functions.
 */
export type ComputeFunction = (opts: ComputeOpts) => Promise<TimelineCred>;

// Note: type should allow extra properties, it's expected to be a subset.
type ComputeEnv = {
  +reporter: TaskReporter,
};

export type CredGraphComputeFunction = (
  opts: CredGraphComputeOpts
) => Promise<CredGraph>;
type CredGraphComputeOpts = {|
  +weightedGraph: WeightedGraph,
  +options: CredGraphOptions,
|};

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
): Promise<TimelineCred> {
  reporter.start("compute-cred");
  const cred = await compute(opts);
  reporter.finish("compute-cred");
  return cred;
}

export async function credGraphComputeTask(
  compute: CredGraphComputeFunction,
  {reporter}: ComputeEnv,
  opts: CredGraphComputeOpts
): Promise<CredGraph> {
  reporter.start("compute-cred-graph");
  const cred = await compute(opts);
  reporter.finish("compute-cred-graph");
  return cred;
}
