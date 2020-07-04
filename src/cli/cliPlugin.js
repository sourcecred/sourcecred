// @flow

import type {PluginDeclaration} from "../analysis/pluginDeclaration";
import type {NodeAddressT} from "../core/graph";
import type {WeightedGraph} from "../core/weightedGraph";
import type {ReferenceDetector} from "../core/references/referenceDetector";
import type {TaskReporter} from "../util/taskReporter";

export type AliasResolver = (string) => ?NodeAddressT;

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
  aliasResolver(PluginDirectoryContext): Promise<AliasResolver>;
}

export interface PluginDirectoryContext {
  configDirectory(): string;
  cacheDirectory(): string;
}
