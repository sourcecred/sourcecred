// @flow

import fs from "fs-extra";
import stringify from "json-stable-stringify";
import {join as pathJoin} from "path";

import {credrank} from "../core/algorithm/credrank";
import {LoggingTaskReporter} from "../util/taskReporter";
import {MarkovProcessGraph} from "../core/markovProcessGraph";
import type {Command} from "./command";
import {loadInstanceConfig} from "./common";
import {fromJSON as weightedGraphFromJSON} from "../core/weightedGraph";

const DEFAULT_ALPHA = 0.2;
const DEFAULT_BETA = 0.5;
const DEFAULT_GAMMA_FORWARD = 0.15;
const DEFAULT_GAMMA_BACKWARD = 0.15;

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const credrankCommand: Command = async (args, std) => {
  if (args.length !== 0) {
    return die(std, "usage: sourcecred credrank");
  }
  const taskReporter = new LoggingTaskReporter();
  taskReporter.start("credrank");

  const baseDir = process.cwd();
  const config = await loadInstanceConfig(baseDir);

  const plugins = Array.from(config.bundledPlugins.values());
  const declarations = plugins.map((x) => x.declaration());

  taskReporter.start("read weighted graph");
  const wgPath = pathJoin(baseDir, "output", "graph.json");
  const wgJson = JSON.parse(await fs.readFile(wgPath));
  const wg = weightedGraphFromJSON(wgJson);
  taskReporter.finish("read weighted graph");

  taskReporter.start("create Markov process graph");
  // TODO: Support loading transition probability params from config.
  const fibrationOptions = {
    what: [].concat(
      ...declarations.map((d) => d.userTypes.map((t) => t.prefix))
    ),
    beta: DEFAULT_BETA,
    gammaForward: DEFAULT_GAMMA_FORWARD,
    gammaBackward: DEFAULT_GAMMA_BACKWARD,
  };
  const seedOptions = {
    alpha: DEFAULT_ALPHA,
  };
  const mpg = MarkovProcessGraph.new(wg, fibrationOptions, seedOptions);
  taskReporter.finish("create Markov process graph");

  taskReporter.start("run CredRank");
  const credGraph = await credrank(mpg);
  taskReporter.finish("run CredRank");

  taskReporter.start("write cred graph");
  const cgJson = stringify(credGraph.toJSON());
  const outputPath = pathJoin(baseDir, "output", "credGraph.json");
  await fs.writeFile(outputPath, cgJson);
  taskReporter.finish("write cred graph");

  return 0;
};

export default credrankCommand;
