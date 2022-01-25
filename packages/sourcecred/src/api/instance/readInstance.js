// @flow

import {ReadOnlyInstance} from "./instance";
import {type CredrankInput} from "../main/credrank";
import {
  type WeightedGraph,
  type WeightedGraphJSON,
  fromJSON as weightedGraphFromJSON,
} from "../../core/weightedGraph";
import type {GraphInput} from "../main/graph";
import type {ContributionsInput} from "../main/contributions";
import type {CredequateInput} from "../main/credequate";
import type {ContributionsByTarget} from "../../core/credequate/contribution";
import type {GrainInput} from "../main/grain";
import type {AnalysisInput} from "../main/analysis";
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
import {CredGrainView, credGrainViewParser} from "../../core/credGrainView";
import {Ledger} from "../../core/ledger/ledger";
import {contributionsByTargetParser} from "../../core/credequate/contribution";
import {
  parser as dependenciesParser,
  type DependenciesConfig,
} from "../dependenciesConfig";
import {type Budget} from "../../core/mintBudget";
import {
  rawParser as pluginBudgetParser,
  upgrade as pluginBudgetUpgrader,
} from "../pluginBudgetConfig";
import {
  rawParser as rawConfigParser,
  type RawInstanceConfig,
} from "../rawInstanceConfig";
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
export const getRawGithubReadInstance = (
  organization: string,
  repository: string,
  branch: string
): ReadInstance =>
  new ReadInstance(
    new NetworkStorage(
      `https://raw.githubusercontent.com/${organization}/${repository}/${branch}/`
    )
  );
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
const CREDGRAPH_PATH: $ReadOnlyArray<string> = ["output", "credGraph"];
const CREDGRAINVIEW_PATH: $ReadOnlyArray<string> = ["output", "credGrainView"];
const GRAPHS_DIRECTORY: $ReadOnlyArray<string> = ["output", "graphs"];
const GRAPHS_PATH: $ReadOnlyArray<string> = ["graph"];
const CONTRIBUTIONS_DIRECTORY: $ReadOnlyArray<string> = [
  "output",
  "contributions",
];
const CONTRIBUTIONS_PATH: $ReadOnlyArray<string> = ["contributions"];

const JSON_SUFFIX: string = ".json";
const ZIP_SUFFIX: string = "";

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

  async readContributionsInput(): Promise<ContributionsInput> {
    throw "not yet implemented";
  }

  async readCredequateInput(): Promise<CredequateInput> {
    const rawInstanceConfig = await this.readRawInstanceConfig();
    const pluginContributions = await Promise.all(
      rawInstanceConfig.credEquatePlugins.map(
        async ({id}) => await this.readPluginContributions(id)
      )
    );
    return {pluginContributions, rawInstanceConfig};
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
    const [credGraph, ledger] = await Promise.all([
      this.readCredGraph(),
      this.readLedger(),
    ]);
    return {
      credGraph,
      ledger,
      featureFlags: {},
    };
  }

  async readWeightedGraphForPlugin(pluginId: string): Promise<WeightedGraph> {
    const outputPath = pathJoin(
      this.createPluginGraphDirectory(pluginId),
      ...GRAPHS_PATH
    );
    const graphJSON = await loadJson(
      this._zipStorage,
      outputPath,
      ((Combo.raw: any): Combo.Parser<WeightedGraphJSON>)
    );
    return weightedGraphFromJSON(graphJSON);
  }

  async readPluginContributions(
    pluginId: string
  ): Promise<{|
    contributionsByTarget: ContributionsByTarget,
    pluginId: string,
  |}> {
    const outputPath = pathJoin(
      this.createPluginContributionsDirectory(pluginId),
      ...CONTRIBUTIONS_PATH
    );
    const contributionsByTarget = await loadJson(
      this._zipStorage,
      outputPath,
      contributionsByTargetParser
    );
    return {contributionsByTarget, pluginId};
  }

  async readCredGraph(): Promise<CredGraph> {
    const credGraphPath = pathJoin(...CREDGRAPH_PATH);
    return await loadJson(
      this._zipStorage,
      credGraphPath + ZIP_SUFFIX,
      credGraphParser
    ).catch(() =>
      loadJson(this._storage, credGraphPath + JSON_SUFFIX, credGraphParser)
    );
  }

  async readCredGrainView(): Promise<CredGrainView> {
    const path = pathJoin(...CREDGRAINVIEW_PATH);
    return loadJson(
      this._zipStorage,
      path + ZIP_SUFFIX,
      credGrainViewParser
    ).catch(() =>
      loadJson(this._storage, path + JSON_SUFFIX, credGrainViewParser)
    );
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
          outputPath + ZIP_SUFFIX,
          ((Combo.raw: any): Combo.Parser<WeightedGraphJSON>)
        ).catch(() =>
          loadJson(
            this._storage,
            outputPath + JSON_SUFFIX,
            ((Combo.raw: any): Combo.Parser<WeightedGraphJSON>)
          )
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
    const raw = await loadJsonWithDefault(
      this._storage,
      budgetPath,
      pluginBudgetParser,
      () => null
    );
    return raw ? await pluginBudgetUpgrader(raw, this._storage) : null;
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

  createPluginGraphDirectory(pluginId: string): string {
    return this.createPluginDirectory(GRAPHS_DIRECTORY, pluginId);
  }

  createPluginContributionsDirectory(pluginId: string): string {
    return this.createPluginDirectory(CONTRIBUTIONS_DIRECTORY, pluginId);
  }
}
