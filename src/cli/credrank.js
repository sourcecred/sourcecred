// @flow

import fs from "fs-extra";
import stringify from "json-stable-stringify";
import {join as pathJoin} from "path";
import {sum} from "d3-array";

import sortBy from "../util/sortBy";
import {credrank} from "../core/credrank/compute";
import {CredGraph} from "../core/credrank/credGraph";
import {LoggingTaskReporter} from "../util/taskReporter";
import {MarkovProcessGraph} from "../core/credrank/markovProcessGraph";
import type {Command} from "./command";
import {loadInstanceConfig, prepareCredData} from "./common";
import {graphIntervals} from "../core/interval";

const DEFAULT_ALPHA = 0.1;
const DEFAULT_BETA = 0.4;
const DEFAULT_GAMMA_FORWARD = 0.1;
const DEFAULT_GAMMA_BACKWARD = 0.1;

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

  taskReporter.start("load data");
  const {weightedGraph, ledger} = await prepareCredData(baseDir, config);
  taskReporter.finish("load data");

  taskReporter.start("create Markov process graph");
  // TODO: Support loading params from config.
  const parameters = {
    beta: DEFAULT_BETA,
    gammaForward: DEFAULT_GAMMA_FORWARD,
    gammaBackward: DEFAULT_GAMMA_BACKWARD,
    alpha: DEFAULT_ALPHA,
  };
  const participants = ledger.accounts().map(({identity}) => ({
    description: identity.name,
    address: identity.address,
    id: identity.id,
  }));
  const intervals = graphIntervals(weightedGraph.graph);
  const mpg = MarkovProcessGraph.new({
    weightedGraph,
    participants,
    parameters,
    intervals,
  });
  taskReporter.finish("create Markov process graph");

  taskReporter.start("run CredRank");
  const credGraph = await credrank(mpg);
  taskReporter.finish("run CredRank");

  taskReporter.start("write cred graph");
  const cgJson = stringify(credGraph.toJSON());
  const outputPath = pathJoin(baseDir, "output", "credGraph.json");
  await fs.writeFile(outputPath, cgJson);
  taskReporter.finish("write cred graph");

  printCredSummaryTable(credGraph);

  taskReporter.finish("credrank");
  return 0;
};

function printCredSummaryTable(credGraph: CredGraph) {
  console.log(`# Top Participants By Cred`);
  console.log();
  console.log(`| Description | Cred | % |`);
  console.log(`| --- | --- | --- |`);
  const credParticipants = Array.from(credGraph.participants());
  const sortedParticipants = sortBy(credParticipants, (p) => -p.cred);
  const totalCred = sum(sortedParticipants, (p) => p.cred);
  function row({cred, description}) {
    const percentage = (100 * cred) / totalCred;
    return `| ${description} | ${cred.toFixed(1)} | ${percentage.toFixed(
      1
    )}% |`;
  }
  sortedParticipants.slice(0, 20).forEach((n) => console.log(row(n)));
}

export default credrankCommand;
