//@flow

import {Graph} from "../core/graph";
import {TaskReporter} from "../util/taskReporter";
import {type TimelineCredParameters} from "../analysis/timeline/params";
import {type PluginDeclaration} from "../analysis/pluginDeclaration";
import {TimelineCred} from "../analysis/timeline/timelineCred";

type ComputeFn = (opts: {|
  graph: Graph,
  params?: $Shape<TimelineCredParameters>,
  plugins: $ReadOnlyArray<PluginDeclaration>,
|}) => Promise<TimelineCred>;

export function timelineCredPlan(
  pluginDeclarations: $ReadOnlyArray<PluginDeclaration>,
  reporter: TaskReporter,
  compute: ComputeFn
) {
  return async (
    graph: Graph,
    params: ?$Shape<TimelineCredParameters>
  ): Promise<TimelineCred> => {
    reporter.start("compute-cred");
    const cred = await compute({
      graph,
      params: params || {},
      plugins: pluginDeclarations,
    });
    reporter.finish("compute-cred");
    return cred;
  };
}
