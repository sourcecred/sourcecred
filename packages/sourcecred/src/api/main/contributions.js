// @flow

import type {ContributionsByTarget} from "../../core/credequate/contribution";
import type {ConfigsByTarget} from "../../core/credequate/config";
import {Ledger} from "../../core/ledger/ledger";
import type {PluginDirectoryContext} from "../plugin";
import {type PluginId} from "../pluginId";
import {Plugin} from "../plugin";
import {type TaskReporter, SilentTaskReporter} from "../../util/taskReporter";
import {ensureIdentityExists} from "../../core/ledger/identityProposal";

export type ContributionsInput = {|
  +plugins: Array<{|
    +plugin: Plugin,
    +directoryContext: PluginDirectoryContext,
    +pluginId: PluginId,
    +configsByTarget: ConfigsByTarget,
  |}>,
  +ledger: Ledger,
|};

export type ContributionsOutput = {|
  +pluginContributions: $ReadOnlyArray<{|
    +pluginId: PluginId,
    +contributionsByTarget: ContributionsByTarget,
  |}>,
  +ledger: Ledger,
|};

/**
Iterates through the provided plugins, runs their `contributions` and
`identities` processes, and updates the ledger with any new IdentityProposals.

Might mutate the ledger that is passed in.
 */
export async function contributions(
  input: ContributionsInput,
  taskReporter: TaskReporter = new SilentTaskReporter()
): Promise<ContributionsOutput> {
  const pluginContributions = [];
  for (const {
    pluginId,
    plugin,
    directoryContext,
    configsByTarget,
  } of input.plugins) {
    const task = `generating CredEquate contributions for ${pluginId}`;
    taskReporter.start(task);
    pluginContributions.push({
      pluginId: pluginId,
      contributionsByTarget: await plugin.contributions(
        directoryContext,
        configsByTarget
      ),
    });
    const identities = await plugin.identities(directoryContext, taskReporter);
    for (const identityProposal of identities) {
      ensureIdentityExists(input.ledger, identityProposal);
    }
    taskReporter.finish(task);
  }
  return {
    pluginContributions,
    ledger: input.ledger,
  };
}
