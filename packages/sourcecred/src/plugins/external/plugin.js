// @flow

import type {Plugin, PluginDirectoryContext} from "../../api/plugin";
import {
  type PluginDeclaration,
  type PluginDeclarationJSON,
  fromJSON as declarationFromJSON,
} from "../../analysis/pluginDeclaration";
import {join as pathJoin} from "path";
import {type TaskReporter} from "../../util/taskReporter";
import type {ReferenceDetector} from "../../core/references";
import {
  type WeightedGraph,
  fromJSON as weightedGraphFromJSON,
  type WeightedGraphJSON,
} from "../../core/weightedGraph";
import {loadJson, loadJsonWithDefault} from "../../util/storage";
import {merge as mergeWeights} from "../../core/weights";
import {weightsForDeclaration} from "../../analysis/pluginDeclaration";
import {type PluginId} from "../../api/pluginId";
import {ZipStorage} from "../../core/storage/zip";
import {
  type IdentityProposal,
  identityProposalsParser,
} from "../../core/ledger/identityProposal";
import * as Combo from "../../util/combo";
import {type DataStorage} from "../../core/storage";
import {NetworkStorage} from "../../core/storage/networkStorage";
import {declaration} from "./defaultDeclaration";
import * as C from "../../util/combo";

export const ExternalPluginIdOwner = "external";

type ExternalPluginConfig = {|
  +baseUrl: string,
|};

const configParser: C.Parser<ExternalPluginConfig> = C.object({
  baseUrl: C.string,
});

export class ExternalPlugin implements Plugin {
  id: PluginId;
  storage: DataStorage;

  async getConfig(): Promise<ExternalPluginConfig | void> {
    return loadJsonWithDefault(
      this.storage,
      "config.json",
      configParser,
      () => undefined
    );
  }

  constructor(id: PluginId, storage: DataStorage) {
    this.id = id;
    this.storage = storage;
  }

  async getStorage(): Promise<DataStorage> {
    const config = await this.getConfig();
    return config ? new NetworkStorage(config.baseUrl) : this.storage;
  }

  async declaration(): Promise<PluginDeclaration> {
    const json = await loadJsonWithDefault(
      await this.getStorage(),
      "declaration.json",
      ((Combo.raw: any): Combo.Parser<PluginDeclarationJSON>),
      () => null
    );
    return json ? declarationFromJSON(json) : declaration(this.id);
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
    const storage = await this.getStorage();
    const graphJSON = await loadJson(
      storage,
      pathJoin(ctx.configDirectory(), "graph.json"),
      ((Combo.raw: any): Combo.Parser<WeightedGraphJSON>)
    ).catch(() => {
      return loadJson(
        new ZipStorage(storage),
        pathJoin(ctx.configDirectory(), "graph.json.gzip"),
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
    _unused_ctx: PluginDirectoryContext
  ): Promise<$ReadOnlyArray<IdentityProposal>> {
    return await loadJsonWithDefault(
      await this.getStorage(),
      "identityProposals.json",
      identityProposalsParser,
      () => []
    );
  }
}
