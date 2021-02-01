// @flow

import {TaskReporter} from "../../util/taskReporter";
import {type WeightedGraph} from "../../core/weightedGraph";
import * as WeightsT from "../../core/weights/weightsT";
import {type ReferenceDetector} from "../../core/references";
import {type PluginDeclaration} from "../../analysis/pluginDeclaration";
import {type InitiativeRepository} from "./initiative";
import {weightsForDeclaration} from "../../analysis/pluginDeclaration";
import {createWeightedGraph} from "./createGraph";
import {
  type InitiativesDirectory,
  type LoadedInitiativesDirectory,
  loadDirectory as _loadDirectory,
} from "./initiativesDirectory";
import {declaration} from "./declaration";

export interface Loader {
  declaration(): PluginDeclaration;
  loadDirectory: typeof loadDirectory;
  createGraph: typeof createGraph;
}

export default ({
  declaration: () => declaration,
  loadDirectory,
  createGraph,
}: Loader);

export async function loadDirectory(
  dir: InitiativesDirectory,
  reporter: TaskReporter
): Promise<LoadedInitiativesDirectory> {
  reporter.start("initiatives");
  const loadedDir = await _loadDirectory(dir);
  reporter.finish("initiatives");
  return loadedDir;
}

export async function createGraph(
  repo: InitiativeRepository,
  refs: ReferenceDetector
): Promise<WeightedGraph> {
  const {graph, weights} = createWeightedGraph(repo, refs);
  const declarationWeights = weightsForDeclaration(declaration);
  const combinedWeights = WeightsT.merge([weights, declarationWeights]);
  return {graph, weights: combinedWeights};
}
