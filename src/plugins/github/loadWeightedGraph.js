// @flow
//
// This module is the entry point for clients of the GitHub plugin that
// want to load a completed WeightedGraph containing GitHub data.
//
// This module is untested, because it is an IO-heavy composition of pieces of
// functionality which are individually quite well tested.

import {loadGraph, type Options} from "./loadGraph";
import {TaskReporter} from "../../util/taskReporter";
import {weightsForDeclaration} from "../../analysis/pluginDeclaration";
import {type WeightedGraph} from "../../core/weightedGraph";
import {declaration} from "./declaration";

export type {Options} from "./loadGraph";

export async function loadWeightedGraph(
  options: Options,
  reporter: TaskReporter
): Promise<WeightedGraph> {
  const graph = await loadGraph(options, reporter);
  const weights = weightsForDeclaration(declaration);
  return {graph, weights};
}
