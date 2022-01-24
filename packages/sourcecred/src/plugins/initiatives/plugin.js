// @flow
import type {Plugin, PluginDirectoryContext} from "../../api/plugin";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import {parser, type InitiativesConfig} from "./config";
import {declaration} from "./declaration";
import {join as pathJoin} from "path";
import type {ReferenceDetector} from "../../core/references";
import type {WeightedGraph} from "../../core/weightedGraph";
import {weightsForDeclaration} from "../../analysis/pluginDeclaration";
import {createWeightedGraph} from "./createGraph";
import {loadJson} from "../../util/storage";
import {loadDirectory as _loadDirectory} from "./initiativesDirectory";
import * as Weights from "../../core/weights";
import type {IdentityProposal} from "../../core/ledger/identityProposal";
import {DiskStorage} from "../../core/storage/disk";
import type {Contribution} from "../../core/credequate/contribution";
import type {ConfigsByTarget} from "../../core/credequate/config";

async function loadConfig(
  ctx: PluginDirectoryContext
): Promise<InitiativesConfig> {
  const storage = new DiskStorage(ctx.configDirectory());
  return loadJson(storage, "config.json", parser);
}

function getDirectoryFromContext(ctx: PluginDirectoryContext): string {
  return pathJoin(ctx.configDirectory(), "initiatives");
}

export class InitiativesPlugin implements Plugin {
  async declaration(): Promise<PluginDeclaration> {
    return declaration;
  }

  // We dont need to load any data since all the initiative files are on disk
  async load(): Promise<void> {}

  async graph(
    ctx: PluginDirectoryContext,
    rd: ReferenceDetector
  ): Promise<WeightedGraph> {
    const {remoteUrl} = await loadConfig(ctx);
    const localPath = getDirectoryFromContext(ctx);

    const {initiatives} = await _loadDirectory({
      remoteUrl,
      localPath,
    });

    const {graph, weights} = createWeightedGraph(initiatives, rd);

    const declarationWeights = weightsForDeclaration(declaration);
    const combinedWeights = Weights.merge([weights, declarationWeights]);

    return {graph, weights: combinedWeights};
  }

  async referenceDetector(
    ctx: PluginDirectoryContext
  ): Promise<ReferenceDetector> {
    const {remoteUrl} = await loadConfig(ctx);
    const localPath = getDirectoryFromContext(ctx);

    const {referenceDetector} = await _loadDirectory({
      remoteUrl,
      localPath,
    });

    return referenceDetector;
  }

  async identities(): Promise<$ReadOnlyArray<IdentityProposal>> {
    // Initiatives plugin is a consumer of identities, but not a producer.
    return [];
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
