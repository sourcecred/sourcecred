// @flow

import fs from "fs-extra";
import stringify from "json-stable-stringify";
import {join as pathJoin} from "path";

import type {Command} from "./command";
import {makePluginDir, loadInstanceConfig, loadJsonWithDefault} from "./common";
import {fromJSON as weightedGraphFromJSON} from "../core/weightedGraph";
import {
  type WeightedGraph,
  merge,
  overrideWeights,
} from "../core/weightedGraph";
import * as Weights from "../core/weights";
import {LoggingTaskReporter} from "../util/taskReporter";
import {
  compute,
  toJSON as credResultToJSON,
  compressByThreshold,
} from "../analysis/credResult";
import * as Params from "../analysis/timeline/params";

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

// Any cred flow that sums to less than this threshold will be filtered
// from the time-level cred data (though we will still have a summary).
// TODO: Make this a configurable parameter.
const CRED_THRESHOLD = 10;

const scoreCommand: Command = async (args, std) => {
  if (args.length !== 0) {
    return die(std, "usage: sourcecred score");
  }
  const taskReporter = new LoggingTaskReporter();
  taskReporter.start("score");
  const baseDir = process.cwd();
  const config = await loadInstanceConfig(baseDir);

  const graphOutputPrefix = ["data", "graphs"];
  async function loadGraph(pluginName): Promise<WeightedGraph> {
    const outputDir = makePluginDir(baseDir, graphOutputPrefix, pluginName);
    const outputPath = pathJoin(outputDir, "graph.json");
    const graphJSON = JSON.parse(await fs.readFile(outputPath));
    return weightedGraphFromJSON(graphJSON);
  }

  const pluginNames = Array.from(config.bundledPlugins.keys());
  const graphs = await Promise.all(pluginNames.map(loadGraph));
  const combinedGraph = merge(graphs);

  // TODO(@decentralion): This is snapshot tested, add unit tests?
  const weightsPath = pathJoin(baseDir, "config", "weights.json");
  const weights = await loadJsonWithDefault(
    weightsPath,
    Weights.parser,
    Weights.empty
  );
  const weightedGraph = overrideWeights(combinedGraph, weights);

  const plugins = Array.from(config.bundledPlugins.values());
  const declarations = plugins.map((x) => x.declaration());

  // TODO(@decentralion): This is snapshot tested, add unit tests?
  const paramsPath = pathJoin(baseDir, "config", "params.json");
  const params = await loadJsonWithDefault(
    paramsPath,
    Params.parser,
    Params.defaultParams
  );

  const credResult = await compute(weightedGraph, params, declarations);
  const compressed = compressByThreshold(credResult, CRED_THRESHOLD);
  const credJSON = stringify(credResultToJSON(compressed));
  const outputPath = pathJoin(baseDir, "output", "credResult.json");
  await fs.writeFile(outputPath, credJSON);
  taskReporter.finish("score");
  return 0;
};

export default scoreCommand;
