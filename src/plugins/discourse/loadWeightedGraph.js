// @flow
//
// This module is the entry point for clients of the Discourse plugin that
// want to load a completed WeightedGraph containing Discourse data.
//
// This module is untested, because it is an IO-heavy composition of pieces of
// functionality which are individually quite well tested.

import {loadDiscourse, type Options} from "./loadDiscourse";
import {TaskReporter} from "../../util/taskReporter";
import {weightsForDeclaration} from "../../analysis/pluginDeclaration";
import {type WeightedGraph} from "../../core/weightedGraph";
import {declaration} from "./declaration";

export type {Options} from "./loadDiscourse";

export async function loadWeightedGraph(
  options: Options,
  reporter: TaskReporter
): Promise<WeightedGraph> {
  const graph = await loadDiscourse(options, reporter);
  const weights = weightsForDeclaration(declaration);
  return {graph, weights};
}
