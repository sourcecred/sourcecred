// @flow

import {Instance} from "./instance";
import {ReadInstance} from "./readInstance";
import {type CredrankInput, type CredrankOutput} from "../main/credrank";
import {type GraphInput, type GraphOutput} from "../main/graph";
import {type GrainInput} from "../main/grain";
import {type AnalysisInput, type AnalysisOutput} from "../main/analysis";
import {
  type WeightsT,
  parser as weightsParser,
  empty as emptyWeights,
} from "../../core/weights";
import {join as pathJoin} from "path";
import stringify from "json-stable-stringify";
import {
  type WeightedGraph,
  type WeightedGraphJSON,
  fromJSON as weightedGraphFromJSON,
  toJSON as weightedGraphToJSON,
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
import {CredGrainView, credGrainViewParser} from "../../core/credGrainView";
import {DiskStorage} from "../../core/storage/disk";
import {ZipStorage,WritableZipStorage} from "../../core/storage/zip";
import {encode} from "../../core/storage/textEncoding";
import * as Combo from "../../util/combo";
import type {PluginDirectoryContext} from "../plugin";
import {type GrainConfig, parser as grainConfigParser} from "../grainConfig";
import {
  parser as currencyConfigParser,
  type CurrencyDetails,
} from "../currencyConfig";
import {defaultCurrencyConfig} from "../currencyConfig";
import {type CredAccountData} from "../../core/ledger/credAccounts";
import {
  type PersonalAttributionsConfig,
  personalAttributionsConfigParser,
} from "../config/personalAttributionsConfig";
import {DataStorage,WritableDataStorage} from "../../core/storage";


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
const INSTANCE_CONFIG_PATH: $ReadOnlyArray<string> = ["sourcecred.json"];
const CREDGRAPH_PATH: $ReadOnlyArray<string> = [
  "output",
  "credGraph.json.gzip",
];
const CREDGRAINVIEW_PATH: $ReadOnlyArray<string> = ["output", "credGrainView"];
const GRAPHS_DIRECTORY: $ReadOnlyArray<string> = ["output", "graphs"];
const GRAPHS_PATH: $ReadOnlyArray<string> = ["graph.json.gzip"];
const LEDGER_PATH: $ReadOnlyArray<string> = ["data", "ledger.json"];
const ACCOUNTS_PATH: $ReadOnlyArray<string> = ["output", "accounts.json"];

/**
This is an Instance implementation that reads and writes using relative paths
on the local disk.
 */
export class LocalInstance extends ReadInstance implements Instance{
  _baseDirectory: string;

  _writableStorage: WritableDataStorage;
  _writableZipStorage: WritableZipStorage;


  constructor(baseDirectory: string) {

    const storage = new DiskStorage(baseDirectory);

    super(storage);
    this._writableStorage = storage;
    this._baseDirectory = baseDirectory;
    this._writableZipStorage = new WritableZipStorage(storage);
    
  }

  //////////////////////////////
  //  Interface Functions
  //////////////////////////////

  async readGraphInput(): Promise<GraphInput> {
    const [instanceConfig, ledger] = await Promise.all([
      this.readInstanceConfig(),
      this.readLedger(),
    ]);
    const plugins = [];
    for (const plugin of instanceConfig.bundledPlugins.values()) {
      plugins.push({
        plugin,
        directoryContext: this.pluginDirectoryContext(plugin.id),
      });
    }
    return {
      plugins,
      ledger,
    };
  }

  async writeGraphOutput(graphOutput: GraphOutput): Promise<void> {
    await Promise.all([
      this.writeLedger(graphOutput.ledger),
      ...graphOutput.pluginGraphs.map(({pluginId, weightedGraph}) =>
        this.writePluginGraph(pluginId, weightedGraph)
      ),
    ]);
  }

  async writeCredrankOutput(credrankOutput: CredrankOutput): Promise<void> {
    await Promise.all([
      this.writeLedger(credrankOutput.ledger),
      this.writeCredGraph(credrankOutput.credGraph),
      this.writeCredGrainView(credrankOutput.credGrainView),
      this.writeDependenciesConfig(credrankOutput.dependencies),
      this.writePersonalAttributionsConfig(credrankOutput.personalAttributions),
    ]);
  }

  async writeAnalysisOutput(analysisOutput: AnalysisOutput): Promise<void> {
    await Promise.all([this.writeCredAccounts(analysisOutput.accounts)]);
  }

  async writeLedger(ledger: Ledger): Promise<void> {
    const ledgerPath = pathJoin(...LEDGER_PATH);
    return this._writableStorage.set(ledgerPath, encode(ledger.serialize()));
  }

  //////////////////////////////
  //  Private Functions
  //////////////////////////////

  async readInstanceConfig(): Promise<InstanceConfig> {
    const pluginsConfigPath = pathJoin(...INSTANCE_CONFIG_PATH);
    return loadJson(this._storage, pluginsConfigPath, configParser);
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
    let path = this._baseDirectory;
    for (const pc of pathComponents) {
      path = pathJoin(path, pc);
      mkdirx(path);
    }
    return pathJoin(...pathComponents);
  }

  pluginDirectoryContext(pluginName: string): PluginDirectoryContext {
    const cacheDir = this.createPluginDirectory(["cache"], pluginName);
    const configDir = this.createPluginDirectory(
      ["config", "plugins"],
      pluginName
    );
    return {
      configDirectory() {
        return configDir;
      },
      cacheDirectory() {
        return cacheDir;
      },
    };
  }

  async writeCredGraph(credGraph: CredGraph): Promise<void> {
    const cgJson = stringify(credGraph.toJSON());
    const outputPath = pathJoin(...CREDGRAPH_PATH);
    return this._writableZipStorage.set(outputPath, encode(cgJson));
  }

  async writeCredGrainView(credGrainView: CredGrainView): Promise<void> {
    const json = stringify(credGrainView.toJSON());
    const outputPath = pathJoin(...CREDGRAINVIEW_PATH);
    return this._writableZipStorage.set(outputPath, encode(json));
  }

  async writePluginGraph(
    pluginId: string,
    weightedGraph: WeightedGraph
  ): Promise<void> {
    const serializedGraph = encode(
      stringify(weightedGraphToJSON(weightedGraph))
    );
    const outputDir = this.createPluginGraphDirectory(pluginId);
    const outputPath = pathJoin(outputDir, ...GRAPHS_PATH);
    return this._writableZipStorage.set(outputPath, serializedGraph);
  }

  async writeDependenciesConfig(
    dependenciesConfig: DependenciesConfig
  ): Promise<void> {
    const dependenciesPath = pathJoin(...DEPENDENCIES_PATH);
    return this._writableStorage.set(
      dependenciesPath,
      stringify(dependenciesConfig, {space: 4})
    );
  }

  async writePersonalAttributionsConfig(
    config: PersonalAttributionsConfig
  ): Promise<void> {
    const path = pathJoin(...PERSONAL_ATTRIBUTIONS_PATH);
    return this._writableStorage.set(path, stringify(config, {space: 4}));
  }

  async writeCredAccounts(credAccounts: CredAccountData): Promise<void> {
    const accountsPath = pathJoin(...ACCOUNTS_PATH);
    return this._writableStorage.set(accountsPath, encode(stringify(credAccounts)));
  }
}
