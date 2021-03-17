// @flow

import {Instance} from "./instance";
import {type CredrankInput, type CredrankOutput} from "../credrank";
import {
  type WeightsT,
  parser as weightsParser,
  empty as emptyWeights,
} from "../../core/weights";
import fs from "fs-extra";
import {join as pathJoin} from "path";
import stringify from "json-stable-stringify";
import {
  type WeightedGraph,
  fromJSON as weightedGraphFromJSON,
} from "../../core/weightedGraph";
import {
  loadJson,
  loadFileWithDefault,
  loadJsonWithDefault,
} from "../../util/storage";
import {mkdirx} from "../../util/disk";
import {parser as configParser, type InstanceConfig} from "../instanceConfig";
import {Ledger} from "../../core/ledger/ledger";
import {
  parser as dependenciesParser,
  type DependenciesConfig,
} from "../dependenciesConfig";
import {type Budget} from "../../core/mintBudget";
import {parser as pluginBudgetParser} from "../pluginBudgetConfig";
import {
  CredGraph,
  parser as credGraphParser,
} from "../../core/credrank/credGraph";
import {DiskStorage} from "../../core/storage/disk";
import {encode} from "../../core/storage/textEncoding";

const DEPENDENCIES_PATH: $ReadOnlyArray<string> = [
  "config",
  "dependencies.json",
];
const WEIGHT_OVERRIDES_PATH: $ReadOnlyArray<string> = [
  "config",
  "weights.json",
];
const BUDGET_PATH: $ReadOnlyArray<string> = ["config", "pluginBudgets.json"];
const INSTANCE_CONFIG_PATH: $ReadOnlyArray<string> = ["sourcecred.json"];
const CREDGRAPH_PATH: $ReadOnlyArray<string> = ["output", "credGraph.json"];
const GRAPHS_DIRECTORY: $ReadOnlyArray<string> = ["output", "graphs"];
const GRAPHS_PATH: $ReadOnlyArray<string> = ["graph.json"];
const LEDGER_PATH: $ReadOnlyArray<string> = ["data", "ledger.json"];

/**
This is an Instance implementation that reads and writes using relative paths
on the local disk.
 */
export class LocalInstance implements Instance {
  _baseDirectory: string;
  _storage: DiskStorage;

  constructor(baseDirectory: string) {
    this._baseDirectory = baseDirectory;
    this._storage = new DiskStorage(baseDirectory);
  }

  //////////////////////////////
  //  Interface Functions
  //////////////////////////////

  async readCredrankInput(): Promise<CredrankInput> {
    const [
      pluginGraphs,
      ledger,
      weightOverrides,
      dependencies,
      pluginsBudget,
    ] = await Promise.all([
      this.readPluginGraphs(),
      this.readLedger(),
      this.readWeightOverrides(),
      this.readDependencies(),
      this.readPluginsBudget(),
    ]);
    return {
      pluginGraphs,
      ledger,
      weightOverrides,
      dependencies,
      pluginsBudget,
    };
  }

  async writeCredrankOutput(credrankOutput: CredrankOutput): Promise<void> {
    await Promise.all([
      this.writeLedger(credrankOutput.ledger),
      this.writeCredGraph(credrankOutput.credGraph),
      this.writeDependenciesConfig(credrankOutput.dependencies),
    ]);
  }

  async readCredGraph(): Promise<CredGraph> {
    const credGraphPath = pathJoin(...CREDGRAPH_PATH);
    return await loadJson(this._storage, credGraphPath, credGraphParser);
  }

  //////////////////////////////
  //  Private Functions
  //////////////////////////////

  async readLedger(): Promise<Ledger> {
    const ledgerPath = pathJoin(...LEDGER_PATH);
    return Ledger.parse(
      await loadFileWithDefault(this._storage, ledgerPath, () =>
        new Ledger().serialize()
      )
    );
  }

  async readInstanceConfig(): Promise<InstanceConfig> {
    const pluginsConfigPath = pathJoin(...INSTANCE_CONFIG_PATH);
    return loadJson(this._storage, pluginsConfigPath, configParser);
  }

  async readPluginGraphs(): Promise<Array<WeightedGraph>> {
    const instanceConfig = await this.readInstanceConfig();
    const pluginNames = Array.from(instanceConfig.bundledPlugins.keys());
    return await Promise.all(
      pluginNames.map(async (name) => {
        const outputDir = this.createPluginDirectory(name);
        const outputPath = pathJoin(outputDir, ...GRAPHS_PATH);
        const graphJSON = JSON.parse(await fs.readFile(outputPath));
        return weightedGraphFromJSON(graphJSON);
      })
    );
  }

  async readWeightOverrides(): Promise<WeightsT> {
    const weightsPath = pathJoin(...WEIGHT_OVERRIDES_PATH);
    return loadJsonWithDefault(
      this._storage,
      weightsPath,
      weightsParser,
      emptyWeights
    );
  }

  async readDependencies(): Promise<DependenciesConfig> {
    const dependenciesPath = pathJoin(...DEPENDENCIES_PATH);
    return await loadJsonWithDefault(
      this._storage,
      dependenciesPath,
      dependenciesParser,
      () => []
    );
  }

  async readPluginsBudget(): Promise<Budget | null> {
    const budgetPath = pathJoin(...BUDGET_PATH);
    return loadJsonWithDefault(
      this._storage,
      budgetPath,
      pluginBudgetParser,
      () => null
    );
  }

  createPluginDirectory(pluginId: string): string {
    const idParts = pluginId.split("/");
    if (idParts.length !== 2) {
      throw new Error(`Bad plugin name: ${pluginId}`);
    }
    const [pluginOwner, pluginName] = idParts;
    const pathComponents = [...GRAPHS_DIRECTORY, pluginOwner, pluginName];
    let path = this._baseDirectory;
    for (const pc of pathComponents) {
      path = pathJoin(path, pc);
      mkdirx(path);
    }
    return path;
  }

  async writeLedger(ledger: Ledger): Promise<void> {
    const ledgerPath = pathJoin(...LEDGER_PATH);
    await this._storage.set(ledgerPath, encode(ledger.serialize()));
  }

  async writeCredGraph(credGraph: CredGraph): Promise<void> {
    const cgJson = stringify(credGraph.toJSON());
    const outputPath = pathJoin(...CREDGRAPH_PATH);
    await this._storage.set(outputPath, encode(cgJson));
  }

  async writeDependenciesConfig(
    dependenciesConfig: DependenciesConfig
  ): Promise<void> {
    const dependenciesPath = pathJoin(...DEPENDENCIES_PATH);
    await this._storage.set(
      dependenciesPath,
      stringify(dependenciesConfig, {space: 4})
    );
  }
}
