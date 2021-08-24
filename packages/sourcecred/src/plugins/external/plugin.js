// @flow

import type {Plugin, PluginDirectoryContext} from "../../api/plugin";
import {
  type PluginDeclaration,
  declarationParser,
} from "../../analysis/pluginDeclaration";
import {join as pathJoin} from "path";
import type {TaskReporter} from "../../util/taskReporter";
import type {ReferenceDetector} from "../../core/references";
import {
  type WeightedGraph,
  fromJSON as weightedGraphFromJSON,
  type WeightedGraphJSON,
} from "../../core/weightedGraph";
import {loadJson, loadJsonWithDefault} from "../../util/storage";
import {merge as mergeWeights} from "../../core/weights";
import {weightsForDeclaration} from "../../analysis/pluginDeclaration";
import type {PluginId} from "../../api/pluginId";
import {ZipStorage} from "../../core/storage/zip";
import {
  type IdentityProposal,
  identityProposalsParser,
} from "../../core/ledger/identityProposal";
import * as Combo from "../../util/combo";
import type {DataStorage} from "../../core/storage";
import {NetworkStorage} from "../../core/storage/networkStorage";
import {declaration as defaultDeclaration} from "./defaultDeclaration";
import * as C from "../../util/combo";

export const ExternalPluginIdOwner = "external";

const FileNames = {
  GRAPH: "graph.json",
  GRAPH_ZIP: "graph",
  DECLARATION: "declaration.json",
  IDENTITIES: "identityProposals.json",
};
type FileType = $Keys<typeof FileNames>;

type ExternalPluginConfig = {|
  +graphUrl: string,
  +declarationUrl?: string,
  +identityProposalsUrl?: string,
|};

const configParser: C.Parser<ExternalPluginConfig> = C.object(
  {
    graphUrl: C.string,
  },
  {
    declarationUrl: C.string,
    identityProposalsUrl: C.string,
  }
);

export class ExternalPlugin implements Plugin {
  id: PluginId;
  storage: ?DataStorage;
  defaultConfigDirectory: PluginDirectoryContext;
  config: ?ExternalPluginConfig;

  constructor(options: {|
    +pluginId: PluginId,
    +storage?: DataStorage,
    +config?: ExternalPluginConfig,
  |}) {
    if (!options.storage && !options.config)
      throw new Error(
        "Must provide either config or storage parameter to construct ExternalPlugin."
      );
    this.id = options.pluginId;
    this.storage = options.storage;
    this.defaultConfigDirectory = {
      configDirectory: () => pathJoin("config/plugins/", options.pluginId),
      cacheDirectory: () => pathJoin("cache/", options.pluginId),
    };
    this.config = options.config;
  }

  async getConfig(
    ctx: PluginDirectoryContext
  ): Promise<ExternalPluginConfig | void> {
    if (this.config) return this.config;
    const path = pathJoin(ctx.configDirectory(), "config.json");
    if (!this.storage)
      throw "Something is wrong. Either storage or config should exist.";
    return loadJsonWithDefault(
      this.storage,
      path,
      configParser,
      () => undefined
    );
  }

  async getStorage(
    ctx: PluginDirectoryContext,
    file: FileType
  ): Promise<{
    storage: DataStorage,
    path: string,
  } | void> {
    const config = await this.getConfig(ctx);
    if (config) {
      switch (file) {
        case "GRAPH":
        case "GRAPH_ZIP":
          return {storage: new NetworkStorage(config.graphUrl), path: ""};
        case "DECLARATION":
          return config.declarationUrl
            ? {
                storage: new NetworkStorage(config.declarationUrl),
                path: "",
              }
            : undefined;
        case "IDENTITIES":
          return config.identityProposalsUrl
            ? {
                storage: new NetworkStorage(config.identityProposalsUrl),
                path: "",
              }
            : undefined;
      }
    }
    if (!this.storage)
      throw "Something is wrong. Either storage or config should exist.";
    return {
      storage: this.storage,
      path: pathJoin(ctx.configDirectory(), FileNames[file]),
    };
  }

  async declaration(): Promise<PluginDeclaration> {
    const result = await this.getStorage(
      this.defaultConfigDirectory,
      "DECLARATION"
    );
    const json = result
      ? await loadJsonWithDefault(
          result.storage,
          result.path,
          declarationParser,
          () => null
        )
      : null;
    return json ? json : defaultDeclaration(this.id);
  }

  async load(
    _unused_ctx: PluginDirectoryContext,
    _unused_reporter: TaskReporter
  ): Promise<void> {
    return;
  }

  async graph(
    ctx: PluginDirectoryContext,
    _unused_rd: ReferenceDetector
  ): Promise<WeightedGraph> {
    const result = await this.getStorage(ctx, "GRAPH");
    const zipResult = await this.getStorage(ctx, "GRAPH_ZIP");
    if (!result || !zipResult)
      throw "Something is wrong. Graph must have storage or config.";
    const graphJSON = await loadJson(
      result.storage,
      result.path,
      ((Combo.raw: any): Combo.Parser<WeightedGraphJSON>)
    ).catch(() => {
      return loadJson(
        new ZipStorage(zipResult.storage),
        zipResult.path,
        ((Combo.raw: any): Combo.Parser<WeightedGraphJSON>)
      );
    });
    const wg = weightedGraphFromJSON(graphJSON);
    const declarationWeights = weightsForDeclaration(await this.declaration());
    return {
      graph: wg.graph,
      weights: mergeWeights([wg.weights, declarationWeights]),
    };
  }

  async referenceDetector(
    _unused_ctx: PluginDirectoryContext
  ): Promise<ReferenceDetector> {
    return {addressFromUrl: () => undefined};
  }

  async identities(
    ctx: PluginDirectoryContext
  ): Promise<$ReadOnlyArray<IdentityProposal>> {
    const result = await this.getStorage(ctx, "IDENTITIES");
    return result
      ? await loadJsonWithDefault(
          result.storage,
          result.path,
          identityProposalsParser,
          () => []
        )
      : [];
  }
}
