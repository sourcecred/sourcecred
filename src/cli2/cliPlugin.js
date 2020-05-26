// @flow

import type {PluginDeclaration} from "../analysis/pluginDeclaration";
import type {PluginLoadContext} from "./pluginLoadContext";
import type {WeightedGraph} from "../core/weightedGraph";

export interface CliPlugin {
  declaration(): PluginDeclaration;
  load(PluginLoadContext): Promise<void>;
  create(PluginLoadContext): Promise<WeightedGraph>;
}
