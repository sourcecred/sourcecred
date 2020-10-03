// @flow

import fs from "fs-extra";
import stringify from "json-stable-stringify";
import {join as pathJoin} from "path";
import deepEqual from "lodash.isequal";

import type {Command} from "./command";
import {loadInstanceConfig, loadWeightedGraph} from "./common";
import {loadFileWithDefault, loadJsonWithDefault} from "../util/disk";
import dedent from "../util/dedent";
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

  const weightedGraph = await loadWeightedGraph(baseDir, config);

  const ledgerPath = pathJoin(baseDir, "data", "ledger.json");
  const ledger = Ledger.parse(
    await loadFileWithDefault(ledgerPath, () => new Ledger().serialize())
  );

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

export const scoreHelp: Command = async (args, std) => {
  std.out(
    dedent`\
      usage: sourcecred score

      Calculate cred scores from existing graph

      'sourcecred graph' must be run prior to this command.
      `.trimRight()
  );
  return 0;
};

export default scoreCommand;
