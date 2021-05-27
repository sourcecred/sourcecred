// @flow

import {ReadOnlyInstance} from "./instance";
import {type CredrankInput} from "../main/credrank";
import {
  type WeightedGraph,
  type WeightedGraphJSON,
  fromJSON as weightedGraphFromJSON,
} from "../../core/weightedGraph";
import {type GraphInput} from "../main/graph";
import {type GrainInput} from "../main/grain";
import {type AnalysisInput} from "../main/analysis";
import {
  type WeightsT,
  parser as weightsParser,
  empty as emptyWeights,
} from "../../core/weights";
import {join as pathJoin} from "path";
import {
  loadJson,
  loadFileWithDefault,
  loadJsonWithDefault,
} from "../../util/storage";
import {
  CredGraph,
  parser as credGraphParser,
} from "../../core/credrank/credGraph";
import {Ledger} from "../../core/ledger/ledger";
import {
  parser as dependenciesParser,
  type DependenciesConfig,
} from "../dependenciesConfig";
import {type Budget} from "../../core/mintBudget";
import {parser as pluginBudgetParser} from "../pluginBudgetConfig";
import {
  rawParser as rawConfigParser,
  type RawInstanceConfig,
} from "../rawinstanceConfig";
import {NetworkStorage} from "../../core/storage/networkStorage";
import {OriginStorage} from "../../core/storage/originStorage";
import {ZipStorage} from "../../core/storage/zip";
import {DataStorage} from "../../core/storage";
import {type GrainConfig, parser as grainConfigParser} from "../grainConfig";
import {
  parser as currencyConfigParser,
  type CurrencyDetails,
} from "../currencyConfig";
import {defaultCurrencyConfig} from "../currencyConfig";
import {
  type PersonalAttributionsConfig,
  personalAttributionsConfigParser,
} from "../config/personalAttributionsConfig";
import * as Combo from "../../util/combo";

export const getNetworkReadInstance = (base: string): ReadInstance =>
  new ReadInstance(new NetworkStorage(base));
export const getOriginReadInstance = (base: string): ReadInstance =>
  new ReadInstance(new OriginStorage(base));

const DEPENDENCIES_PATH: $ReadOnlyArray<string> = [
  "config",
  "dependencies.json",
];

const WEIGHT_OVERRIDES_PATH: $ReadOnlyArray<string> = [
  "config",
  "weights.json",
];

const BUDGET_PATH: $ReadOnlyArray<string> = ["config", "pluginBudgets.json"];

const GRAIN_PATH: $ReadOnlyArray<string> = ["config", "grain.json"];
const CURRENCY_PATH: $ReadOnlyArray<string> = [
  "config",
  "currencyDetails.json",
];
const PERSONAL_ATTRIBUTIONS_PATH: $ReadOnlyArray<string> = [
  "config",
  "personalAttributions.json",
];
const RAW_INSTANCE_CONFIG_PATH: $ReadOnlyArray<string> = ["sourcecred.json"];
const LEDGER_PATH: $ReadOnlyArray<string> = ["data", "ledger.json"];
const CREDGRAPH_PATH: $ReadOnlyArray<string> = [
  "output",
  "credGraph.json.gzip",
];
const GRAPHS_DIRECTORY: $ReadOnlyArray<string> = ["output", "graphs"];
const GRAPHS_PATH: $ReadOnlyArray<string> = ["graph.json.gzip"];

/**
This is an Instance implementation that reads and writes using relative paths
on the given base URL. The base URL given should end with a trailing slash.
 */
export class ReadInstance implements ReadOnlyInstance {
  _storage: DataStorage;
  _zipStorage: ZipStorage;

  constructor(storage: DataStorage) {
    this._storage = storage;
    this._zipStorage = new ZipStorage(this._storage);
  }

  async readGraphInput(): Promise<GraphInput> {
    throw "not yet implemented";
  }

  async readCredrankInput(): Promise<CredrankInput> {
    const [
      pluginGraphs,
      ledger,
      weightOverrides,
      dependencies,
      pluginsBudget,
      personalAttributions,
    ] = await Promise.all([
      this.readPluginGraphs(),
      this.readLedger(),
      this.readWeightOverrides(),
      this.readDependencies(),
      this.readPluginsBudget(),
      this.readPersonalAttributions(),
    ]);
    return {
      pluginGraphs,
      ledger,
      weightOverrides,
      dependencies,
      pluginsBudget,
      personalAttributions,
    };
  }

  async readGrainInput(): Promise<GrainInput> {
    const [
      credGraph,
      ledger,
      grainConfig,
      currencyDetails,
    ] = await Promise.all([
      this.readCredGraph(),
      this.readLedger(),
      this.readGrainConfig(),
      this.readCurrencyDetails(),
    ]);
    return {
      credGraph,
      ledger,
      grainConfig,
      currencyDetails,
    };
  }

  async readAnalysisInput(): Promise<AnalysisInput> {
    throw "not yet implemented";
  }

  async readWeightedGraphForPlugin(): Promise<WeightedGraph> {
    throw "not yet implemented";
  }

  async readCredGraph(): Promise<CredGraph> {
    const credGraphPath = pathJoin(...CREDGRAPH_PATH);
    return await loadJson(this._zipStorage, credGraphPath, credGraphParser);
  }

  async readLedger(): Promise<Ledger> {
    const ledgerPath = pathJoin(...LEDGER_PATH);
    return loadFileWithDefault(this._storage, ledgerPath, () =>
      new Ledger().serialize()
    ).then((result) => Ledger.parse(result));
  }

  async readGrainConfig(): Promise<GrainConfig> {
    const grainConfigPath = pathJoin(...GRAIN_PATH);
    return loadJson(this._storage, grainConfigPath, grainConfigParser);
  }

  async readCurrencyDetails(): Promise<CurrencyDetails> {
    const currencyDetailsPath = pathJoin(...CURRENCY_PATH);
    return loadJsonWithDefault(
      this._storage,
      currencyDetailsPath,
      currencyConfigParser,
      defaultCurrencyConfig
    );
  }

  // Private Functions

  async readRawInstanceConfig(): Promise<RawInstanceConfig> {
    const pluginsConfigPath = pathJoin(...RAW_INSTANCE_CONFIG_PATH);
    return loadJson(this._storage, pluginsConfigPath, rawConfigParser);
  }

  async readPersonalAttributions(): Promise<PersonalAttributionsConfig> {
    const path = pathJoin(...PERSONAL_ATTRIBUTIONS_PATH);
    return loadJsonWithDefault(
      this._storage,
      path,
      personalAttributionsConfigParser,
      () => []
    );
  }

  async readPluginGraphs(): Promise<Array<WeightedGraph>> {
    const instanceConfig = await this.readRawInstanceConfig();
    const pluginNames = instanceConfig.bundledPlugins;
    return await Promise.all(
      pluginNames.map(async (name) => {
        const outputDir = this.createPluginDirectory(GRAPHS_DIRECTORY, name);
        const outputPath = pathJoin(outputDir, ...GRAPHS_PATH);
        const graphJSON = await loadJson(
          this._zipStorage,
          outputPath,
          ((Combo.raw: any): Combo.Parser<WeightedGraphJSON>)
        );
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
    return loadJsonWithDefault(
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

  createPluginDirectory(
    components: $ReadOnlyArray<string>,
    pluginId: string
  ): string {
    const idParts = pluginId.split("/");
    if (idParts.length !== 2) {
      throw new Error(`Bad plugin name: ${pluginId}`);
    }
    const [pluginOwner, pluginName] = idParts;
    const pathComponents = [...components, pluginOwner, pluginName];
    return pathJoin(...pathComponents);
  }
}
