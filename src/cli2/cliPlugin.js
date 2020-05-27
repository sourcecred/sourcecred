// @flow

import type {PluginDeclaration} from "../analysis/pluginDeclaration";
import type {WeightedGraph} from "../core/weightedGraph";
import type {ReferenceDetector} from "../core/references/referenceDetector";

export interface CliPlugin {
  declaration(): PluginDeclaration;
  load(PluginDirectoryContext): Promise<void>;
  graph(PluginDirectoryContext, ReferenceDetector): Promise<WeightedGraph>;
  referenceDetector(PluginDirectoryContext): Promise<ReferenceDetector>;
}

export interface PluginDirectoryContext {
  configDirectory(): string;
  cacheDirectory(): string;
}
