// @flow

import fs from "fs-extra";
import stringify from "json-stable-stringify";
import {join as pathJoin} from "path";

import type {Command} from "./command";
import {makePluginDir, loadInstanceConfig} from "./common";
import {
  toJSON as weightedGraphToJSON,
  fromJSON as weightedGraphFromJSON,
  type WeightedGraph,
  merge,
} from "../core/weightedGraph";

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const mergeCommand: Command = async (args, std) => {
  if (args.length !== 0) {
    die(std, "usage: sourcecred merge");
  }
  const baseDir = process.cwd();
  const config = await loadInstanceConfig(baseDir);
  const graphOutputPrefix = ["output", "graphs"];

  async function loadGraph(pluginName): Promise<WeightedGraph> {
    const outputDir = makePluginDir(baseDir, graphOutputPrefix, pluginName);
    const outputPath = pathJoin(outputDir, "graph.json");
    const graphJSON = JSON.parse(await fs.readFile(outputPath));
    return weightedGraphFromJSON(graphJSON);
  }

  const pluginNames = Array.from(config.bundledPlugins.keys());
  const graphs = await Promise.all(pluginNames.map(loadGraph));

  // TODO: Support identity merging.
  // TODO: Support weight overrides.
  const combinedGraph = merge(graphs);

  const outputPath = pathJoin(baseDir, "output", "graph.json");
  const serializedGraph = stringify(weightedGraphToJSON(combinedGraph));
  await fs.writeFile(outputPath, serializedGraph);
  return 0;
};

export default mergeCommand;
