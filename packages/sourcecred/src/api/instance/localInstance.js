// @flow

import {Instance} from "./instance";
import {ReadInstance} from "./readInstance";
import {type CredrankOutput} from "../main/credrank";
import {type GraphInput, type GraphOutput} from "../main/graph";
import {type AnalysisOutput} from "../main/analysis";
import {join as pathJoin} from "path";
import stringify from "json-stable-stringify";
import {
  type WeightedGraph,
  toJSON as weightedGraphToJSON,
} from "../../core/weightedGraph";
import {loadJson} from "../../util/storage";
import {mkdirx} from "../../util/disk";
import {parser as configParser, type InstanceConfig} from "../instanceConfig";
import {Ledger} from "../../core/ledger/ledger";
import {type DependenciesConfig} from "../dependenciesConfig";
import {CredGraph} from "../../core/credrank/credGraph";
import {CredGrainView} from "../../core/credGrainView";
import {DiskStorage} from "../../core/storage/disk";
import {WritableZipStorage} from "../../core/storage/zip";
import {encode} from "../../core/storage/textEncoding";
import type {PluginDirectoryContext} from "../plugin";
import {type CredAccountData} from "../../core/ledger/credAccounts";
import {WritableDataStorage} from "../../core/storage";
import {type PersonalAttributionsConfig} from "../config/personalAttributionsConfig";
import type {GrainIntegrationResult} from "../../core/ledger/grainIntegration";

const DEPENDENCIES_PATH: $ReadOnlyArray<string> = [
  "config",
  "dependencies.json",
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
const GRAPHS_PATH: $ReadOnlyArray<string> = ["graph.json.gzip"];
const LEDGER_PATH: $ReadOnlyArray<string> = ["data", "ledger.json"];
const ACCOUNTS_PATH: $ReadOnlyArray<string> = ["output", "accounts.json"];
const GRAIN_INTEGRATION_DIRECTORY: $ReadOnlyArray<string> = [
  "output",
  "grainIntegration",
];

/**
This is an Instance implementation that reads and writes using relative paths
on the local disk.
 */
export class LocalInstance extends ReadInstance implements Instance {
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

  async writeGrainIntegrationOutput(
    result: GrainIntegrationResult
  ): Promise<void> {
    if (!result.output) {
      return;
    }
    const {fileName, content} = result.output;
    mkdirx(pathJoin(...GRAIN_INTEGRATION_DIRECTORY));
    const credDateString = new Date(
      result.distributionCredTimestamp
      // utilise the `SE` datestring format since it appears like `YYYY-MM-DD`
      // with numbers and is therefore easy to sort on and human-readable.
    ).toLocaleDateString("en-SE");
    const grainIntegrationPath = pathJoin(
      ...GRAIN_INTEGRATION_DIRECTORY,
      credDateString + "_" + fileName
    );
    this._writableStorage.set(grainIntegrationPath, encode(content));
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
    return this._writableStorage.set(
      accountsPath,
      encode(stringify(credAccounts))
    );
  }
}
