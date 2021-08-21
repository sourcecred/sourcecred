// @flow

import {type WeightedGraph} from "../../core/weightedGraph";
import {Ledger} from "../../core/ledger/ledger";
import type {PluginDirectoryContext} from "../plugin";
import {type PluginId} from "../pluginId";
import {Plugin} from "../plugin";
import {type TaskReporter, SilentTaskReporter} from "../../util/taskReporter";
import {CascadingReferenceDetector} from "../../core/references/cascadingReferenceDetector";
import {type ReferenceDetector} from "../../core/references/referenceDetector";
import {ensureIdentityExists} from "../../core/ledger/identityProposal";

export type GraphInput = {|
  +plugins: Array<{|
    +plugin: Plugin,
    +directoryContext: PluginDirectoryContext,
  |}>,
  +ledger: Ledger,
|};

export type GraphOutput = {|
  +pluginGraphs: $ReadOnlyArray<{|
    +pluginId: PluginId,
    +weightedGraph: WeightedGraph,
  |}>,
  +ledger: Ledger,
|};

/**
 
 
 Might mutate the ledger that is passed in.
 */
export async function graph(
  input: GraphInput,
  scope?: $ReadOnlyArray<PluginId>,
  taskReporter: TaskReporter = new SilentTaskReporter()
): Promise<GraphOutput> {
  // Build Reference Detector
  const rds = [];
  for (const {plugin, directoryContext} of input.plugins) {
    const task = `reference detector for ${plugin.id}`;
    taskReporter.start(task);
    const rd = await plugin.referenceDetector(directoryContext, taskReporter);
    rds.push(rd);
    taskReporter.finish(task);
  }
  rds.push(_hackyIdentityNameReferenceDetector(input.ledger));
  const rd = new CascadingReferenceDetector(rds);
  // Build graphs
  const pluginGraphs = [];
  for (const {plugin, directoryContext} of input.plugins) {
    if (!scope || scope.includes(plugin.id)) {
      const task = `generating graph for ${plugin.id}`;
      taskReporter.start(task);
      pluginGraphs.push({
        pluginId: plugin.id,
        weightedGraph: await plugin.graph(directoryContext, rd, taskReporter),
      });
      const identities = await plugin.identities(
        directoryContext,
        taskReporter
      );
      for (const identityProposal of identities) {
        ensureIdentityExists(input.ledger, identityProposal);
      }
      taskReporter.finish(task);
    }
  }
  return {
    pluginGraphs,
    ledger: input.ledger,
  };
}

// Hack to support old-school (deprecated) "initiatives files":
// We need to be able to parse references to usernames, e.g. "@yalor", so
// we need a reference detector that will match these to identities in the
// Ledger. This isn't a robust addressing scheme, since identities are re-nameable;
// in v2 the initiatives plugin will be re-written to use identity node addresses instead.
// This hack can be safely deleted once we no longer support initiatives files that refer
// to identities by their names instead of their IDs.
export function _hackyIdentityNameReferenceDetector(
  ledger: Ledger
): ReferenceDetector {
  const usernameToAddress = new Map(
    ledger
      .accounts()
      .map((a) => [a.identity.name.toLowerCase(), a.identity.address])
  );
  function addressFromUrl(potentialUsername: string) {
    const prepped = potentialUsername.replace("@", "").toLowerCase();
    return usernameToAddress.get(prepped);
  }
  return {addressFromUrl};
}
