// @flow

import fs from "fs-extra";
import stringify from "json-stable-stringify";
import {join as pathJoin} from "path";

import type {Command} from "./command";
import {loadInstanceConfig} from "./common";
import {fromJSON as weightedGraphFromJSON} from "../core/weightedGraph";
import {defaultParams} from "../analysis/timeline/params";
import {TimelineCred} from "../analysis/timeline/timelineCred";
import {LoggingTaskReporter} from "../util/taskReporter";
import {
  fromTimelineCredAndPlugins,
  COMPAT_INFO as OUTPUT_COMPAT_INFO,
} from "../analysis/output";
import {toCompat} from "../util/compat";

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const scoreCommand: Command = async (args, std) => {
  if (args.length !== 0) {
    return die(std, "usage: sourcecred score");
  }
  const taskReporter = new LoggingTaskReporter();
  taskReporter.start("score");
  const baseDir = process.cwd();
  const config = await loadInstanceConfig(baseDir);

  const graphFilePath = pathJoin(baseDir, "output", "graph.json");
  const graphJSON = JSON.parse(await fs.readFile(graphFilePath));
  const graph = weightedGraphFromJSON(graphJSON);

  const plugins = Array.from(config.bundledPlugins.values());
  const declarations = plugins.map((x) => x.declaration());

  // TODO: Support loading params from config.
  const params = defaultParams();

  const tc = await TimelineCred.compute({
    weightedGraph: graph,
    params,
    plugins: declarations,
  });
  const output = fromTimelineCredAndPlugins(tc, declarations);
  const outputJSON = stringify(toCompat(OUTPUT_COMPAT_INFO, output));
  const outputPath = pathJoin(baseDir, "output", "cred.json");
  await fs.writeFile(outputPath, outputJSON);
  taskReporter.finish("score");
  return 0;
};

export default scoreCommand;
