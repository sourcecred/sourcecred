// @flow

import type {PluginDeclaration} from "../analysis/pluginDeclaration";
import type {WeightedGraph} from "../core/weightedGraph";
import type {ReferenceDetector} from "../core/references/referenceDetector";
import type {TaskReporter} from "../util/taskReporter";
import type {PluginId} from "./pluginId";
import type {IdentityProposal} from "../core/ledger/identityProposal";

export interface Plugin {
  +id: PluginId;
  declaration(): Promise<PluginDeclaration>;
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
  identities(
    PluginDirectoryContext,
    TaskReporter
  ): Promise<$ReadOnlyArray<IdentityProposal>>;
}

export interface PluginDirectoryContext {
  configDirectory(): string;
  cacheDirectory(): string;
}
