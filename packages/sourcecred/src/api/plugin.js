// @flow

import type {PluginDeclaration} from "../analysis/pluginDeclaration";
import type {WeightedGraph} from "../core/weightedGraph";
import type {ReferenceDetector} from "../core/references/referenceDetector";
import type {TaskReporter} from "../util/taskReporter";
import type {IdentityProposal} from "../core/ledger/identityProposal";
import type {
  ContributionsByTarget,
} from "../core/credEquate/contribution";
import type {ConfigsByTarget} from "../core/credEquate/config";

export interface Plugin {
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
  contributions(
    PluginDirectoryContext,
    ConfigsByTarget
  ): Promise<ContributionsByTarget>;
}

export interface PluginDirectoryContext {
  configDirectory(): string;
  cacheDirectory(): string;
}
