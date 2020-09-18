// @flow

import fs from "fs-extra";
import stringify from "json-stable-stringify";
import {join as pathJoin} from "path";
import deepEqual from "lodash.isequal";

import type {Command} from "./command";
import {
  makePluginDir,
  loadInstanceConfig,
  pluginDirectoryContext,
} from "./common";
import * as NullUtil from "../util/null";
import {loadFileWithDefault, loadJsonWithDefault} from "../util/disk";
import {fromJSON as weightedGraphFromJSON} from "../core/weightedGraph";
import {
  type WeightedGraph,
  merge,
  overrideWeights,
} from "../core/weightedGraph";
import * as Weights from "../core/weights";
import {LoggingTaskReporter} from "../util/taskReporter";
import {
  compute,
  toJSON as credResultToJSON,
  stripOverTimeDataForNonUsers,
} from "../analysis/credResult";
import {CredView} from "../analysis/credView";
import * as Params from "../analysis/timeline/params";
import {contractions as identityContractions} from "../ledger/identity";
import {Ledger} from "../ledger/ledger";
import {computeCredAccounts} from "../ledger/credAccounts";
import {
  parser as dependenciesParser,
  ensureIdentityExists,
  toDependencyPolicy,
} from "../api/dependenciesConfig";
import {ensureIdentityExists as ensurePluginIdentityExists} from "../ledger/identityProposal";
import sortBy from "lodash.sortby";
import {type ReferenceDetector} from "../core/references/referenceDetector";
import {CascadingReferenceDetector} from "../core/references/cascadingReferenceDetector";
import {toJSON as weightedGraphToJSON} from "../core/weightedGraph";
import {type PluginId, parser as pluginIdParser} from "../api/pluginId";

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const scoreCommand: Command = async (args, std) => {
  let pluginsToLoad: PluginId[] = [];
  const baseDir = process.cwd();
  const config = await loadInstanceConfig(baseDir);
  if (args.length === 0) {
    pluginsToLoad = Array.from(config.bundledPlugins.keys());
  } else {
    for (const arg of args) {
      const id = pluginIdParser.parseOrThrow(arg);
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
  const taskReporter = new LoggingTaskReporter();

  // begin generating graphs
  taskReporter.start("graph");
  const ledgerPath = pathJoin(baseDir, "data", "ledger.json");
  const ledger = Ledger.parse(
    await loadFileWithDefault(ledgerPath, () => new Ledger().serialize())
  );
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
      ensurePluginIdentityExists(ledger, identityProposal);
    }
    taskReporter.finish(task);
  }
  await fs.writeFile(ledgerPath, ledger.serialize());
  taskReporter.finish("graph");

  taskReporter.start("score");

  async function loadGraph(pluginName): Promise<WeightedGraph> {
    const outputDir = makePluginDir(baseDir, graphOutputPrefix, pluginName);
    const outputPath = pathJoin(outputDir, "graph.json");
    const graphJSON = JSON.parse(await fs.readFile(outputPath));
    return weightedGraphFromJSON(graphJSON);
  }

  const pluginNames = Array.from(config.bundledPlugins.keys());
  const graphs = await Promise.all(pluginNames.map(loadGraph));
  const combinedGraph = merge(graphs);

  // TODO(@decentralion): This is snapshot tested, add unit tests?
  const weightsPath = pathJoin(baseDir, "config", "weights.json");
  const weights = await loadJsonWithDefault(
    weightsPath,
    Weights.parser,
    Weights.empty
  );
  const weightedGraph = overrideWeights(combinedGraph, weights);

  const dependenciesPath = pathJoin(baseDir, "config", "dependencies.json");
  const dependencies = await loadJsonWithDefault(
    dependenciesPath,
    dependenciesParser,
    () => []
  );
  const dependenciesWithIds = dependencies.map((d) =>
    ensureIdentityExists(d, ledger)
  );
  if (!deepEqual(dependenciesWithIds, dependencies)) {
    // Save the new dependencies, with canonical IDs set.
    await fs.writeFile(
      dependenciesPath,
      stringify(dependenciesWithIds, {space: 4})
    );
    // Save the Ledger, since we may have added/activated identities.
    await fs.writeFile(ledgerPath, ledger.serialize());
  }

  const dependencyPolicies = dependenciesWithIds.map((d) =>
    toDependencyPolicy(d, ledger)
  );

  const identities = ledger.accounts().map((a) => a.identity);
  const contractedGraph = weightedGraph.graph.contractNodes(
    identityContractions(identities)
  );
  const contractedWeightedGraph = {
    graph: contractedGraph,
    weights: weightedGraph.weights,
  };

  const plugins = Array.from(config.bundledPlugins.values());
  const declarations = plugins.map((x) => x.declaration());

  // TODO(@decentralion): This is snapshot tested, add unit tests?
  const paramsPath = pathJoin(baseDir, "config", "params.json");
  const params = await loadJsonWithDefault(
    paramsPath,
    Params.parser,
    Params.defaultParams
  );

  const credResult = await compute(
    contractedWeightedGraph,
    params,
    declarations,
    dependencyPolicies
  );
  // Throw away over-time data for all non-user nodes; we may not have that
  // information available once we merge CredRank, anyway.
  const stripped = stripOverTimeDataForNonUsers(credResult);
  const credJSON = stringify(credResultToJSON(stripped));
  const outputPath = pathJoin(baseDir, "output", "credResult.json");
  await fs.writeFile(outputPath, credJSON);

  // Write out the account data for convenient usage.
  // Note: this is an experimental format and may change or get
  // removed in the future.
  const credView = new CredView(credResult);
  const credAccounts = computeCredAccounts(ledger, credView);
  const accountsPath = pathJoin(baseDir, "output", "accounts.json");
  await fs.writeFile(accountsPath, stringify(credAccounts));

  taskReporter.finish("score");
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

export default scoreCommand;
