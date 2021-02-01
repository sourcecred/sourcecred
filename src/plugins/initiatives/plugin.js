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
import {
  type PluginId,
  fromString as pluginIdFromString,
} from "../../api/pluginId";
import {loadJson} from "../../util/disk";
import {loadDirectory as _loadDirectory} from "./initiativesDirectory";
import * as WeightsT from "../../core/weights/weightsT";
import type {IdentityProposal} from "../../core/ledger/identityProposal";

async function loadConfig(
  ctx: PluginDirectoryContext
): Promise<InitiativesConfig> {
  const path = pathJoin(ctx.configDirectory(), "config.json");
  return loadJson(path, parser);
}

function getDirectoryFromContext(ctx: PluginDirectoryContext): string {
  return pathJoin(ctx.configDirectory(), "initiatives");
}

export class InitiativesPlugin implements Plugin {
  id: PluginId = pluginIdFromString("sourcecred/initiatives");

  declaration(): PluginDeclaration {
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
    const combinedWeights = WeightsT.merge([weights, declarationWeights]);

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
}
