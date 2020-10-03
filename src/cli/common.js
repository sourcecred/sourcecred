// @flow

import {join as pathJoin} from "path";
import fs from "fs-extra";
import {loadJson, mkdirx} from "../util/disk";

import type {PluginDirectoryContext} from "../api/plugin";
import {
  parser as configParser,
  type InstanceConfig,
} from "../api/instanceConfig";

import {
  type WeightedGraph,
  merge,
  overrideWeights,
  fromJSON as weightedGraphFromJSON,
} from "../core/weightedGraph";
import {loadJsonWithDefault} from "../util/disk";

import * as Weights from "../core/weights";

export function loadInstanceConfig(baseDir: string): Promise<InstanceConfig> {
  const projectFilePath = pathJoin(baseDir, "sourcecred.json");
  return loadJson(projectFilePath, configParser);
}

export function makePluginDir(
  baseDir: string,
  prefix: $ReadOnlyArray<string>,
  pluginId: string
): string {
  const idParts = pluginId.split("/");
  if (idParts.length !== 2) {
    throw new Error(`Bad plugin name: ${pluginId}`);
  }
  const [pluginOwner, pluginName] = idParts;
  const pathComponents = [...prefix, pluginOwner, pluginName];
  let path = baseDir;
  for (const pc of pathComponents) {
    path = pathJoin(path, pc);
    mkdirx(path);
  }
  return path;
}

export function pluginDirectoryContext(
  baseDir: string,
  pluginName: string
): PluginDirectoryContext {
  const cacheDir = makePluginDir(baseDir, ["cache"], pluginName);
  const configDir = makePluginDir(baseDir, ["config", "plugins"], pluginName);
  return {
    configDirectory() {
      return configDir;
    },
    cacheDirectory() {
      return cacheDir;
    },
  };
}

export async function loadWeightedGraph(
  baseDir: string,
  config: InstanceConfig
): Promise<WeightedGraph> {
  const graphOutputPrefix = ["output", "graphs"];
  async function loadGraph(pluginName): Promise<WeightedGraph> {
    const outputDir = makePluginDir(baseDir, graphOutputPrefix, pluginName);
    const outputPath = pathJoin(outputDir, "graph.json");
    const graphJSON = JSON.parse(await fs.readFile(outputPath));
    return weightedGraphFromJSON(graphJSON);
  }

  const pluginNames = Array.from(config.bundledPlugins.keys());
  const graphs = await Promise.all(pluginNames.map(loadGraph));
  const combinedGraph = merge(graphs);

  // TODO(@decentralion): This is snapshot tested via TimelineCred, add unit
  // tests?
  const weightsPath = pathJoin(baseDir, "config", "weights.json");
  const weights = await loadJsonWithDefault(
    weightsPath,
    Weights.parser,
    Weights.empty
  );
  return overrideWeights(combinedGraph, weights);
}
