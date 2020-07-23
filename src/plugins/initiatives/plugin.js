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
import * as Weights from "../../core/weights";

async function loadConfig(
  dirContext: PluginDirectoryContext
): Promise<InitiativesConfig> {
  const dirname = dirContext.configDirectory();
  const path = pathJoin(dirname, "config.json");
  return loadJson(path, parser);
}

const DIRECTORY_ENV_VAR_NAME = "SOURCECRED_INITIATIVES_DIRECTORY";

function getDirectoryFromEnv(): string {
  const rawDir = process.env[DIRECTORY_ENV_VAR_NAME] || "initiatives";
  if (rawDir == null) {
    throw new Error(
      `No initiatives directory provided: set ${DIRECTORY_ENV_VAR_NAME}`
    );
  }
  return rawDir;
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
    const localPath = getDirectoryFromEnv();

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
    const localPath = getDirectoryFromEnv();

    const {referenceDetector} = await _loadDirectory({
      remoteUrl,
      localPath,
    });

    return referenceDetector;
  }
}
