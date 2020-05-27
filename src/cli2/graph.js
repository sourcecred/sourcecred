// @flow

import fs from "fs-extra";
import sortBy from "lodash.sortby";
import stringify from "json-stable-stringify";
import {join as pathJoin} from "path";

import {CascadingReferenceDetector} from "../core/references/cascadingReferenceDetector";
import type {Command} from "./command";
import {
  makePluginDir,
  loadInstanceConfig,
  pluginDirectoryContext,
} from "./common";
import {toJSON as weightedGraphToJSON} from "../core/weightedGraph";

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const loadCommand: Command = async (args, std) => {
  if (args.length !== 0) {
    die(std, "usage: sourcecred graph");
  }
  const baseDir = process.cwd();
  const config = await loadInstanceConfig(baseDir);
  const graphOutputPrefix = ["output", "graphs"];

  const rd = await buildReferenceDetector(baseDir, config);
  for (const [name, plugin] of config.bundledPlugins) {
    const dirContext = pluginDirectoryContext(baseDir, name);
    const graph = await plugin.graph(dirContext, rd);
    const serializedGraph = stringify(weightedGraphToJSON(graph));
    const outputDir = makePluginDir(baseDir, graphOutputPrefix, name);
    const outputPath = pathJoin(outputDir, "graph.json");
    await fs.writeFile(outputPath, serializedGraph);
  }
  return 0;
};

async function buildReferenceDetector(baseDir, config) {
  const rds = [];
  for (const [name, plugin] of sortBy(
    [...config.bundledPlugins],
    ([k, _]) => k
  )) {
    const dirContext = pluginDirectoryContext(baseDir, name);
    const rd = await plugin.referenceDetector(dirContext);
    rds.push(rd);
  }
  return new CascadingReferenceDetector(rds);
}

export default loadCommand;
