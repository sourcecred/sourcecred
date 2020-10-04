// @flow

import fs from "fs-extra";
import sortBy from "lodash.sortby";
import stringify from "json-stable-stringify";
import {join as pathJoin} from "path";

import {Ledger} from "../ledger/ledger";
import * as NullUtil from "../util/null";
import {LoggingTaskReporter} from "../util/taskReporter";
import {type ReferenceDetector} from "../core/references/referenceDetector";
import {CascadingReferenceDetector} from "../core/references/cascadingReferenceDetector";
import type {Command} from "./command";
import dedent from "../util/dedent";
import {type InstanceConfig} from "../api/instanceConfig";
import {
  makePluginDir,
  loadInstanceConfig,
  pluginDirectoryContext,
  loadLedger,
  saveLedger,
} from "./common";
import {toJSON as weightedGraphToJSON} from "../core/weightedGraph";
import * as pluginId from "../api/pluginId";
import {ensureIdentityExists} from "../ledger/identityProposal";

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const graphCommand: Command = async (args, std) => {
  const taskReporter = new LoggingTaskReporter();
  taskReporter.start("graph");
  const baseDir = process.cwd();
  const config: InstanceConfig = await loadInstanceConfig(baseDir);

  const ledger = await loadLedger(baseDir);

  let pluginsToLoad = [];
  if (args.length === 0) {
    pluginsToLoad = config.bundledPlugins.keys();
  } else {
    for (const arg of args) {
      const id = pluginId.fromString(arg);
      if (config.bundledPlugins.has(id)) {
        pluginsToLoad.push(id);
      } else {
        return die(
          std,
          `can't find plugin ${id}; remember to use fully scoped name, as in sourcecred/github`
        );
      }
    }
  }

  const graphOutputPrefix = ["output", "graphs"];

  const rd = await buildReferenceDetector(
    baseDir,
    config,
    taskReporter,
    ledger
  );
  for (const name of pluginsToLoad) {
    const plugin = NullUtil.get(config.bundledPlugins.get(name));
    const task = `${name}: generating graph`;
    taskReporter.start(task);
    const dirContext = pluginDirectoryContext(baseDir, name);
    const graph = await plugin.graph(dirContext, rd, taskReporter);
    const serializedGraph = stringify(weightedGraphToJSON(graph));
    const outputDir = makePluginDir(baseDir, graphOutputPrefix, name);
    const outputPath = pathJoin(outputDir, "graph.json");
    await fs.writeFile(outputPath, serializedGraph);

    const identities = await plugin.identities(dirContext, taskReporter);
    for (const identityProposal of identities) {
      ensureIdentityExists(ledger, identityProposal);
    }
    taskReporter.finish(task);
  }
  await saveLedger(baseDir, ledger);
  taskReporter.finish("graph");
  return 0;
};

async function buildReferenceDetector(baseDir, config, taskReporter, ledger) {
  taskReporter.start("reference detector");
  const rds = [];
  for (const [name, plugin] of sortBy(
    [...config.bundledPlugins],
    ([k, _]) => k
  )) {
    const dirContext = pluginDirectoryContext(baseDir, name);
    const task = `reference detector for ${name}`;
    taskReporter.start(task);
    const rd = await plugin.referenceDetector(dirContext, taskReporter);
    rds.push(rd);
    taskReporter.finish(task);
  }
  taskReporter.finish("reference detector");
  rds.push(_hackyIdentityNameReferenceDetector(ledger));
  return new CascadingReferenceDetector(rds);
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
    ledger.accounts().map((a) => [a.identity.name, a.identity.address])
  );
  function addressFromUrl(potentialUsername: string) {
    const prepped = potentialUsername.replace("@", "").toLowerCase();
    return usernameToAddress.get(prepped);
  }
  return {addressFromUrl};
}

export const graphHelp: Command = async (args, std) => {
  std.out(
    dedent`\
      usage: sourcecred graph

      Generate a graph from cached plugin data

      Either 'sourcecred load' must immediately precede this command or
      a cache directory must exist for all plugins specified in sourcecred.json
      `.trimRight()
  );
  return 0;
};

export default graphCommand;
