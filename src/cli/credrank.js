// @flow

import fs from "fs-extra";
import stringify from "json-stable-stringify";
import {join as pathJoin} from "path";
import {sum} from "d3-array";

import sortBy from "../util/sortBy";
import {credrank} from "../core/credrank/compute";
import {CredGraph} from "../core/credrank/credGraph";
import {LoggingTaskReporter} from "../util/taskReporter";
import {computeBonusMinting, createBonusGraph} from "../core/bonusMinting";
import type {Command} from "./command";
import {loadInstanceConfig, prepareCredData} from "./common";
import {merge} from "../core/weightedGraph";

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
  const {weightedGraph, ledger, dependencies} = await prepareCredData(
    baseDir,
    config
  );
  const bonusGraph = createBonusGraph(
    computeBonusMinting(weightedGraph, dependencies)
  );
  const combinedWeightedGraph = merge([weightedGraph, bonusGraph]);
  taskReporter.finish("load data");

  taskReporter.start("run CredRank");
  const credGraph = await credrank(combinedWeightedGraph, ledger);
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
