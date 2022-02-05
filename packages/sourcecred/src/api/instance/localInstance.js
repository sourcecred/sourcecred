// @flow

import {Instance} from "./instance";
import {ReadInstance} from "./readInstance";
import type {CredrankOutput} from "../main/credrank";
import type {CredequateOutput} from "../main/credequate";
import type {GraphInput, GraphOutput} from "../main/graph";
import type {GrainInput} from "../main/grain";
import type {
  ContributionsInput,
  ContributionsOutput,
} from "../main/contributions";
import type {AnalysisOutput} from "../main/analysis";
import type {Neo4jOutput} from "../main/analysisUtils/neo4j";
import {join as pathJoin} from "path";
import {raw as rawParser} from "../../util/combo";
import stringify from "json-stable-stringify";
import {
  type WeightedGraph,
  toJSON as weightedGraphToJSON,
} from "../../core/weightedGraph";
import {loadJson} from "../../util/storage";
import {mkdirx} from "../../util/disk";
import {toISO} from "../../util/timestamp";
import {parser as configParser, type InstanceConfig} from "../instanceConfig";
import {Ledger} from "../../core/ledger/ledger";
import type {ContributionsByTarget} from "../../core/credequate/contribution";
import type {DependenciesConfig} from "../dependenciesConfig";
import {CredGraph} from "../../core/credrank/credGraph";
import {CredGrainView} from "../../core/credGrainView";
import {DiskStorage} from "../../core/storage/disk";
import {WritableZipStorage} from "../../core/storage/zip";
import {encode} from "../../core/storage/textEncoding";
import type {PluginDirectoryContext} from "../plugin";
import {type CredAccountData} from "../../core/ledger/credAccounts";
import {WritableDataStorage} from "../../core/storage";
import {type PersonalAttributionsConfig} from "../config/personalAttributionsConfig";
import type {GrainIntegrationMultiResult} from "../main/grain";

const DEPENDENCIES_PATH: $ReadOnlyArray<string> = [
  "config",
  "dependencies.json",
];

const PERSONAL_ATTRIBUTIONS_PATH: $ReadOnlyArray<string> = [
  "config",
  "personalAttributions.json",
];

const GRAIN_PATH: $ReadOnlyArray<string> = ["config", "grain.json"];
const INSTANCE_CONFIG_PATH: $ReadOnlyArray<string> = ["sourcecred.json"];
const CREDGRAPH_PATH: $ReadOnlyArray<string> = ["output", "credGraph"];
const SCORED_CONTRIBUTIONS_PATH: $ReadOnlyArray<string> = [
  "output",
  "scoredContributions",
];
const CREDGRAINVIEW_PATH: $ReadOnlyArray<string> = ["output", "credGrainView"];
const GRAPHS_PATH: $ReadOnlyArray<string> = ["graph"];
const CONTRIBUTIONS_PATH: $ReadOnlyArray<string> = ["contributions"];
const LEDGER_PATH: $ReadOnlyArray<string> = ["data", "ledger.json"];
const ACCOUNTS_PATH: $ReadOnlyArray<string> = ["output", "accounts.json"];
const NEO4J_DIRECTORY: $ReadOnlyArray<string> = ["output", "neo4j"];
const GRAIN_INTEGRATION_DIRECTORY: $ReadOnlyArray<string> = [
  "output",
  "grainIntegration",
];

const JSON_SUFFIX: string = ".json";
const CSV_SUFFIX: string = ".csv";
const ZIP_SUFFIX: string = "";

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
    for (const [pluginId, plugin] of instanceConfig.bundledPlugins.entries()) {
      plugins.push({
        pluginId,
        plugin,
        directoryContext: this.pluginDirectoryContext(pluginId),
      });
    }
    return {
      plugins,
      ledger,
    };
  }

  async readContributionsInput(): Promise<ContributionsInput> {
    const instanceConfig = await this.readInstanceConfig();
    const ledger = await this.readLedger();
    const plugins = [];
    for (const {
      id: pluginId,
      plugin,
      configsByTarget,
    } of instanceConfig.credEquatePlugins) {
      plugins.push({
        pluginId,
        plugin,
        directoryContext: this.pluginDirectoryContext(pluginId),
        configsByTarget,
      });
    }
    return {
      plugins,
      ledger,
    };
  }

  async writeGraphOutput(
    graphOutput: GraphOutput,
    shouldZip: boolean = true
  ): Promise<void> {
    await Promise.all([
      this.writeLedger(graphOutput.ledger),
      ...graphOutput.pluginGraphs.map(({pluginId, weightedGraph}) =>
        this.writePluginGraph(pluginId, weightedGraph, shouldZip)
      ),
    ]);
  }

  async writeContributionsOutput(
    contributionsOutput: ContributionsOutput,
    shouldZip?: boolean
  ): Promise<void> {
    await Promise.all([
      this.writeLedger(contributionsOutput.ledger),
      ...contributionsOutput.pluginContributions.map(
        ({pluginId, contributionsByTarget}) =>
          this.writePluginContributions(
            pluginId,
            contributionsByTarget,
            shouldZip
          )
      ),
    ]);
  }

  async writeCredrankOutput(
    credrankOutput: CredrankOutput,
    shouldZip: boolean = true
  ): Promise<void> {
    await Promise.all([
      this.writeLedger(credrankOutput.ledger),
      this.writeCredGraph(credrankOutput.credGraph, shouldZip),
      this.writeCredGrainView(credrankOutput.credGrainView, shouldZip),
      this.writeDependenciesConfig(credrankOutput.dependencies),
      this.writePersonalAttributionsConfig(credrankOutput.personalAttributions),
    ]);
  }

  async writeCredequateOutput(
    credequateOutput: CredequateOutput,
    shouldZip: boolean = true
  ): Promise<void> {
    const json = stringify(Array.from(credequateOutput.scoredContributions));
    const outputPath =
      pathJoin(...SCORED_CONTRIBUTIONS_PATH) +
      (shouldZip ? ZIP_SUFFIX : JSON_SUFFIX);
    const storage = shouldZip
      ? this._writableZipStorage
      : this._writableStorage;
    return storage.set(outputPath, encode(json));
  }

  async writeAnalysisOutput(analysisOutput: AnalysisOutput): Promise<void> {
    await Promise.all([
      this.writeCredAccounts(analysisOutput.accounts),
      this.writeNeo4jOutput(analysisOutput.neo4j),
    ]);
  }

  async writeLedger(ledger: Ledger): Promise<void> {
    const ledgerPath = pathJoin(...LEDGER_PATH);
    return this._writableStorage.set(ledgerPath, encode(ledger.serialize()));
  }

  async writeGrainIntegrationOutput(
    result: $Shape<GrainIntegrationMultiResult>
  ): Promise<void> {
    if (!result.output) {
      return;
    }
    const {fileName, content} = result.output;
    mkdirx(pathJoin(...GRAIN_INTEGRATION_DIRECTORY));
    const credDateString = toISO(result.distributionCredTimestamp);
    const grainIntegrationPath = pathJoin(
      ...GRAIN_INTEGRATION_DIRECTORY,
      credDateString + "_" + fileName
    );
    this._writableStorage.set(grainIntegrationPath, encode(content));
  }

  /**
   *
   */
  async updateGrainIntegrationConfig(
    result: $Shape<GrainIntegrationMultiResult>,
    config: GrainInput
  ): Promise<void> {
    const configName = config.grainConfig.integration?.name;
    if (!configName) return;
    const configUpdate = result.configUpdate;
    if (configUpdate && Object.keys(configUpdate).length > 0) {
      const grainConfigPath = pathJoin(...GRAIN_PATH);
      const currentConfig = await loadJson<any>(
        this._storage,
        grainConfigPath,
        rawParser
      );
      const newConfig = {
        ...currentConfig,
        integration: {
          ...currentConfig.integration,
          config: {
            ...currentConfig.integration.config,
            ...configUpdate,
          },
        },
      };
      await this._writableStorage.set(
        grainConfigPath,
        stringify(newConfig, {space: 2})
      );
    }
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

  async writeCredGraph(
    credGraph: CredGraph,
    shouldZip: boolean = true
  ): Promise<void> {
    const cgJson = stringify(credGraph.toJSON());
    const outputPath =
      pathJoin(...CREDGRAPH_PATH) + (shouldZip ? ZIP_SUFFIX : JSON_SUFFIX);
    const storage = shouldZip
      ? this._writableZipStorage
      : this._writableStorage;
    return storage.set(outputPath, encode(cgJson));
  }

  async writeCredGrainView(
    credGrainView: CredGrainView,
    shouldZip: boolean = true
  ): Promise<void> {
    const json = stringify(credGrainView.toJSON());
    const outputPath =
      pathJoin(...CREDGRAINVIEW_PATH) + (shouldZip ? ZIP_SUFFIX : JSON_SUFFIX);
    const storage = shouldZip
      ? this._writableZipStorage
      : this._writableStorage;
    return storage.set(outputPath, encode(json));
  }

  async writePluginGraph(
    pluginId: string,
    weightedGraph: WeightedGraph,
    shouldZip: boolean = true
  ): Promise<void> {
    const serializedGraph = encode(
      stringify(weightedGraphToJSON(weightedGraph))
    );
    const outputDir = this.createPluginGraphDirectory(pluginId);
    const outputPath =
      pathJoin(outputDir, ...GRAPHS_PATH) +
      (shouldZip ? ZIP_SUFFIX : JSON_SUFFIX);
    const storage = shouldZip
      ? this._writableZipStorage
      : this._writableStorage;
    return storage.set(outputPath, serializedGraph);
  }

  async writePluginContributions(
    pluginId: string,
    contributionsByTarget: ContributionsByTarget,
    shouldZip: boolean = true
  ): Promise<void> {
    const contributionsByTargetResolved = {};
    // This removes a lot of the benefit of having an iterable, and should be
    // made more efficient in the future.
    for (const k of Object.keys(contributionsByTarget)) {
      contributionsByTargetResolved[k] = Array.from(contributionsByTarget[k]);
    }
    const serializedContributions = encode(
      stringify(contributionsByTargetResolved)
    );
    const outputDir = this.createPluginContributionsDirectory(pluginId);
    const outputPath =
      pathJoin(outputDir, ...CONTRIBUTIONS_PATH) +
      (shouldZip ? ZIP_SUFFIX : JSON_SUFFIX);
    const storage = shouldZip
      ? this._writableZipStorage
      : this._writableStorage;
    return storage.set(outputPath, serializedContributions);
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

  async writeNeo4jOutput(neo4jOutput: Neo4jOutput | void): Promise<void> {
    if (!neo4jOutput) return;
    mkdirx(pathJoin(...NEO4J_DIRECTORY));
    await Promise.all([
      this.writeFromIterator(
        neo4jOutput.nodes,
        NEO4J_DIRECTORY,
        "nodes_",
        CSV_SUFFIX,
        false
      ),
      this.writeFromIterator(
        neo4jOutput.edges,
        NEO4J_DIRECTORY,
        "edges_",
        CSV_SUFFIX,
        false
      ),
    ]);
  }

  async writeFromIterator(
    iterator: Iterator<string>,
    directory: $ReadOnlyArray<string>,
    prefix: string,
    suffix: string,
    shouldZip: boolean
  ): Promise<void> {
    const promises = [];
    const storage = shouldZip
      ? this._writableZipStorage
      : this._writableStorage;
    let n = 1;
    for (const str of iterator) {
      const path = pathJoin(...directory, prefix + n + suffix);
      promises.push(storage.set(path, encode(str)));
      n++;
    }
    await Promise.all(promises);
  }
}
