// @flow

import {join as pathJoin} from "path";
import fs from "fs-extra";
import {loadJson, mkdirx} from "../util/disk";
import deepEqual from "lodash.isequal";
import stringify from "json-stable-stringify";

import {type BonusPolicy} from "../core/bonusMinting";
import type {PluginDirectoryContext} from "../api/plugin";
import {
  parser as configParser,
  type InstanceConfig,
} from "../api/instanceConfig";
import {Ledger} from "../core/ledger/ledger";
import {contractions as identityContractions} from "../core/identity";
import {
  parser as dependenciesParser,
  ensureIdentityExists,
  toBonusPolicy,
} from "../api/dependenciesConfig";
import {
  type WeightedGraph,
  merge,
  overrideWeights,
  fromJSON as weightedGraphFromJSON,
} from "../core/weightedGraph";
import {CredGraph, parser as credGraphParser} from "../core/credrank/credGraph";
import {loadFileWithDefault, loadJsonWithDefault} from "../util/disk";
import {parser as pluginBudgetParser} from "../api/pluginBudgetConfig";
import {applyBudget, type Budget} from "../core/mintBudget";

import * as Weights from "../core/weights";

export function loadInstanceConfig(baseDir: string): Promise<InstanceConfig> {
  const projectFilePath = pathJoin(baseDir, "sourcecred.json");
  return loadJson(projectFilePath, configParser);
}

export function makePluginDir(
  baseDir: string,
  prefix: $ReadOnlyArray<string>,
  pluginId: string
): string {
  const idParts = pluginId.split("/");
  if (idParts.length !== 2) {
    throw new Error(`Bad plugin name: ${pluginId}`);
  }
  const [pluginOwner, pluginName] = idParts;
  const pathComponents = [...prefix, pluginOwner, pluginName];
  let path = baseDir;
  for (const pc of pathComponents) {
    path = pathJoin(path, pc);
    mkdirx(path);
  }
  return path;
}

export function pluginDirectoryContext(
  baseDir: string,
  pluginName: string
): PluginDirectoryContext {
  const cacheDir = makePluginDir(baseDir, ["cache"], pluginName);
  const configDir = makePluginDir(baseDir, ["config", "plugins"], pluginName);
  return {
    configDirectory() {
      return configDir;
    },
    cacheDirectory() {
      return cacheDir;
    },
  };
}

/**
 * This method pipelines the data loading needed to run Cred analysis.
 *
 * It's a bit of a kitchen sink, but I think it's still valuable to have as its
 * own method. In particular, there are some non-obvious relationships between
 * the constituent components: it's important that the identities be computed
 * after loading the dependencies, because loading the dependencies may create
 * new identities. Thus, I prefer to expose this API which sequences the steps
 * correctly, rather than trusting the caller to do this themselves.
 */
export async function prepareCredData(
  baseDir: string,
  config: InstanceConfig
): Promise<{|
  weightedGraph: WeightedGraph,
  ledger: Ledger,
  dependencies: $ReadOnlyArray<BonusPolicy>,
|}> {
  const [weightedGraph, ledger] = await Promise.all([
    await loadAndMergePluginWeigtedGraphs(baseDir, config),
    await loadLedger(baseDir),
  ]);

  const budget = await loadPluginBudget(baseDir);
  // We need to load the dependencies before we get identities, because
  // this step may create new identities in the ledger.
  const dependencies = await loadDependenciesAndWriteChanges(baseDir, ledger);

  const identities = ledger.accounts().map((a) => a.identity);
  const contractedGraph = weightedGraph.graph.contractNodes(
    identityContractions(identities)
  );
  let contractedWeightedGraph = {
    graph: contractedGraph,
    weights: weightedGraph.weights,
  };
  if (budget != null) {
    contractedWeightedGraph = applyBudget(contractedWeightedGraph, budget);
  }
  return {weightedGraph: contractedWeightedGraph, ledger, dependencies};
}

async function loadDependenciesAndWriteChanges(
  baseDir: string,
  ledger: Ledger
): Promise<$ReadOnlyArray<BonusPolicy>> {
  const dependenciesPath = pathJoin(baseDir, "config", "dependencies.json");
  const dependencies = await loadJsonWithDefault(
    dependenciesPath,
    dependenciesParser,
    () => []
  );
  const dependenciesWithIds = dependencies.map((d) =>
    // This mutates the ledger, adding new identites when needed.
    ensureIdentityExists(d, ledger)
  );
  if (!deepEqual(dependenciesWithIds, dependencies)) {
    // Save the new dependencies, with canonical IDs set.
    await fs.writeFile(
      dependenciesPath,
      stringify(dependenciesWithIds, {space: 4})
    );
    // Save the Ledger, since we may have added/activated identities.
    await saveLedger(baseDir, ledger);
  }

  return dependenciesWithIds.map((d) => toBonusPolicy(d, ledger));
}

export async function loadWeightedGraphForPlugin(
  pluginName: string,
  baseDir: string
): Promise<WeightedGraph> {
  const graphOutputPrefix = ["output", "graphs"];
  const outputDir = makePluginDir(baseDir, graphOutputPrefix, pluginName);
  const outputPath = pathJoin(outputDir, "graph.json");
  const graphJSON = JSON.parse(await fs.readFile(outputPath));
  return weightedGraphFromJSON(graphJSON);
}

/**
 * Loads a weighted graph of all plugins' weighted graphs
 * merged together.
 */
export async function loadAndMergePluginWeigtedGraphs(
  baseDir: string,
  config: InstanceConfig
): Promise<WeightedGraph> {
  const pluginNames = Array.from(config.bundledPlugins.keys());
  const graphs = await Promise.all(
    pluginNames.map((name) => loadWeightedGraphForPlugin(name, baseDir))
  );
  const combinedGraph = merge(graphs);

  // TODO(@decentralion): This is snapshot tested via TimelineCred, add unit
  // tests?
  const weightsPath = pathJoin(baseDir, "config", "weights.json");
  const weights = await loadJsonWithDefault(
    weightsPath,
    Weights.parser,
    Weights.empty
  );
  return overrideWeights(combinedGraph, weights);
}

export async function loadCredGraph(baseDir: string): Promise<CredGraph> {
  const credGraphPath = pathJoin(baseDir, "output", "credGraph.json");
  return await loadJson(credGraphPath, credGraphParser);
}

export async function loadLedger(baseDir: string): Promise<Ledger> {
  const ledgerPath = pathJoin(baseDir, "data", "ledger.json");
  return Ledger.parse(
    await loadFileWithDefault(ledgerPath, () => new Ledger().serialize())
  );
}

export async function saveLedger(
  baseDir: string,
  ledger: Ledger
): Promise<void> {
  const ledgerPath = pathJoin(baseDir, "data", "ledger.json");
  await fs.writeFile(ledgerPath, ledger.serialize());
}

function loadPluginBudget(baseDir: string): Promise<Budget | null> {
  const budgetPath = pathJoin(baseDir, "config", "pluginBudgets.json");
  return loadJsonWithDefault(budgetPath, pluginBudgetParser, () => null);
}
