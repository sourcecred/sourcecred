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
  empty as emptyWeightedGraph,
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
import type {Contribution} from "../../core/credequate/contribution";
import type {ConfigsByTarget} from "../../core/credequate/config";

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

/**
A dynamic plugin that allows 3rd parties to rapidly pipe data into an instance.

The External plugin can be used multiple times, because it simply uses the 
PluginId pattern "external/X" where X can be any name (but preferably an agreed 
upon name between the 3rd-party software and the instance maintainer).

The External plugin loads its graph and optionally its declaration and 
identityProposals from either:
1. the plugin config folder on disk
    - To use this method, simply place the files into the 
      `config/plugins/external/X` folder.
2. a base url that statically serves the files
    - To use this method, simply serve the files statically with cross-origin 
      enabled in the same directory, and add a `config.json` file in the 
      instance's `config/plugins/external/X` folder with form: 
      `{ "Url": "https://www.myhost.com/path/to/directory" }`

Supported files for either method are:
1. `graph.json`/`graph.json.gzip` (required) - works whether or not it is 
    compressed using our library
2. `declaration.json` (optional) - if omitted, a default declaration with
    minimal node/edge types is used, but also graphs don't have to adhere to the
    declaration if they don't desire to be configured using our 
    Weight Configuration UI.
3. `identityProposals.json` (optional) - if omitted, no identities are proposed

*/
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

  async contributions(
    _unused_ctx: PluginDirectoryContext,
    _unused_configsByTarget: ConfigsByTarget
  ): Promise<{[string]: Iterable<Contribution>}> {
    throw new Error(
      "This plugin has not been updated to support the Contributions API."
    );
  }
}

/**
A way for 3rd-party developers to easily test their External Plugin.
After generating a WeightedGraph, a Declaration, and IdentityProposals,
a developer could instantiate a ConstructorPlugin and pass it into our
`graph` API using our library in environments such as Observable.
This is a prerequisite for testing using `credrank` because of the 
IdentityProposals. Once satisfied with the result, they can serve their files
for consumption by an ExternalPlugin configuration.
 */
export class ConstructorPlugin {
  _weightedGraph: WeightedGraph;
  _identityProposals: $ReadOnlyArray<IdentityProposal>;
  _declaration: PluginDeclaration;

  constructor(options: {|
    +weightedGraph?: WeightedGraph,
    +identityProposals?: $ReadOnlyArray<IdentityProposal>,
    +declaration?: PluginDeclaration,
    +pluginId?: PluginId,
  |}) {
    this._weightedGraph = options.weightedGraph || emptyWeightedGraph();
    this._identityProposals = options.identityProposals || [];
    if (options.declaration) this._declaration = options.declaration;
    else if (options.pluginId)
      this._declaration = defaultDeclaration(options.pluginId);
    else throw new Error("Must provide either a declaration or a pluginId");
  }

  async declaration(): Promise<PluginDeclaration> {
    return this._declaration;
  }

  async load(
    _unused_ctx: PluginDirectoryContext,
    _unused_reporter: TaskReporter
  ): Promise<void> {}

  async graph(
    _unused_ctx: PluginDirectoryContext,
    _unused_rd: ReferenceDetector
  ): Promise<WeightedGraph> {
    return this._weightedGraph;
  }

  async referenceDetector(
    _unused_ctx: PluginDirectoryContext
  ): Promise<ReferenceDetector> {
    return {addressFromUrl: () => undefined};
  }

  async identities(
    _unused_ctx: PluginDirectoryContext
  ): Promise<$ReadOnlyArray<IdentityProposal>> {
    return this._identityProposals;
  }

  async contributions(
    _unused_ctx: PluginDirectoryContext,
    _unused_configsByTarget: ConfigsByTarget
  ): Promise<{[string]: Iterable<Contribution>}> {
    throw new Error(
      "This plugin has not been updated to support the Contributions API."
    );
  }
}
