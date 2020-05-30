// @flow

import type {PluginDeclaration} from "../analysis/pluginDeclaration";
import type {WeightedGraph} from "../core/weightedGraph";
import type {ReferenceDetector} from "../core/references/referenceDetector";
import type {TaskReporter} from "../util/taskReporter";

export interface CliPlugin {
  declaration(): PluginDeclaration;
  load(PluginDirectoryContext, TaskReporter): Promise<void>;
  graph(
    PluginDirectoryContext,
    ReferenceDetector,
    TaskReporter
  ): Promise<WeightedGraph>;
  referenceDetector(
    PluginDirectoryContext,
    TaskReporter
  ): Promise<ReferenceDetector>;
}

export interface PluginDirectoryContext {
  configDirectory(): string;
  cacheDirectory(): string;
}
