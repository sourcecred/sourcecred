// @flow

import fs from "fs-extra";
import stringify from "json-stable-stringify";
import {join as pathJoin} from "path";

import type {Command} from "./command";
import {makePluginDir, loadInstanceConfig} from "./common";
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
import {
  contractions as identityContractions,
  declaration as identityDeclaration,
} from "../ledger/identity";
import {Ledger} from "../ledger/ledger";
import {computeCredAccounts} from "../ledger/credAccounts";

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const scoreCommand: Command = async (args, std) => {
  if (args.length !== 0) {
    return die(std, "usage: sourcecred score");
  }
  const taskReporter = new LoggingTaskReporter();
  taskReporter.start("score");
  const baseDir = process.cwd();
  const config = await loadInstanceConfig(baseDir);

  const graphOutputPrefix = ["output", "graphs"];
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

  const ledgerPath = pathJoin(baseDir, "data", "ledger.json");
  const ledger = Ledger.parse(
    await loadFileWithDefault(ledgerPath, () => new Ledger().serialize())
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
  if (identities.length) {
    declarations.push(identityDeclaration);
  }

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
    declarations
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

export default scoreCommand;
