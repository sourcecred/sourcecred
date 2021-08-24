// @flow

import {sum} from "d3-array";
import {format} from "d3-format";

import dedent from "../util/dedent";
import sortBy from "../util/sortBy";
import {credrank} from "../api/main/credrank";
import {CredGraph, type Participant} from "../core/credrank/credGraph";
import {LoggingTaskReporter} from "../util/taskReporter";
import type {Command} from "./command";
import {type Uuid} from "../util/uuid";
import {Instance} from "../api/instance/instance";
import {LocalInstance} from "../api/instance/localInstance";

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const credrankCommand: Command = async (args, std) => {
  let shouldIncludeDiff = false;
  let isSimulation = false;
  let shouldRunStealth = false;
  let shouldZipOutput = true;
  const processedArgs = args.filter((arg) => {
    switch (arg) {
      case "-d":
        shouldIncludeDiff = true;
        return false;
      case "--stealth":
        shouldRunStealth = true;
        return false;
      case "-s":
      case "--simulation":
        isSimulation = true;
        return false;
      case "--no-zip":
        shouldZipOutput = false;
        return false;
      default:
        return true;
    }
  });

  if (processedArgs.length !== 0) {
    return die(
      std,
      "usage: sourcecred credrank [-d] [-s | --simulation] [--stealth] [--no-zip]"
    );
  }
  const taskReporter = new LoggingTaskReporter();
  taskReporter.start("credrank");

  taskReporter.start("load data");
  const baseDir = process.cwd();
  const instance: Instance = await new LocalInstance(baseDir);
  const credrankInput = await instance.readCredrankInput();
  taskReporter.finish("load data");

  taskReporter.start("run CredRank");
  const credrankOutput = await credrank(credrankInput);
  const {credGraph} = credrankOutput;
  taskReporter.finish("run CredRank");

  if (shouldIncludeDiff) {
    taskReporter.start("load prior graph");
    try {
      const priorCredGraph = await instance.readCredGraph();
      printCredDiffTable(credGraph, priorCredGraph, std);
    } catch (e) {
      std.out(
        `Could not load or compare existing credGraph.json. Skipping diff. Error: ${e.message}`
      );
      printCredSummaryTable(credGraph, std);
    }
    taskReporter.finish("load prior graph");
  } else if (!shouldRunStealth) {
    printCredSummaryTable(credGraph, std);
  }

  if (!isSimulation) {
    taskReporter.start("writing changes");
    instance.writeCredrankOutput(credrankOutput, shouldZipOutput);
    taskReporter.finish("writing changes");
  }

  taskReporter.finish("credrank");
  return 0;
};

function printCredSummaryTable(credGraph: CredGraph, std) {
  std.out(`# Top Participants By Cred`);
  std.out(``);
  std.out(`| Description | Cred | % |`);
  std.out(`| --- | --- | --- |`);
  const credParticipants = Array.from(credGraph.participants());
  const sortedParticipants = sortBy(credParticipants, (p) => -p.cred);
  const totalCred = sum(sortedParticipants, (p) => p.cred);
  function row({cred, description}) {
    const percentage = (100 * cred) / totalCred;
    return `| ${description} | ${cred.toFixed(1)} | ${percentage.toFixed(
      1
    )}% |`;
  }
  sortedParticipants.slice(0, 20).forEach((n) => std.out(row(n)));
}

function printCredDiffTable(
  credGraph: CredGraph,
  priorCredGraph: CredGraph,
  std
) {
  std.out(`# Top Participants By New Cred`);
  const priorParticipants: Map<Uuid, Participant> = new Map();
  for (const participant of priorCredGraph.participants())
    priorParticipants.set(participant.id, participant);

  const credParticipants = Array.from(credGraph.participants());
  const sortedParticipants = sortBy(credParticipants, (p) => -p.cred);
  if (credParticipants.length !== Array.from(priorParticipants.keys()).length)
    throw Error(
      `Number of participants has changed. Rerun without -d to refresh.`
    );
  function row({cred, description, id}) {
    const prior = priorParticipants.get(id);
    if (!prior)
      throw Error(
        `Participant [${description}, ${id}] exists in the new scores but not in the old. Rerun without -d to refresh.`
      );
    const changeFactor = (cred - prior.cred) / prior.cred;
    const percentageChangeStr =
      changeFactor > 100 ? ">10,000%" : format(",.1%")(changeFactor);
    return {
      "Name": description,
      "Prior Cred": prior.cred.toFixed(1),
      "New Cred": cred.toFixed(1),
      "% Change": percentageChangeStr,
    };
  }
  console.table(sortedParticipants.slice(0, 20).map((n) => row(n)));
}

export const credRankHelp: Command = async (args, std) => {
  std.out(
    dedent`\
      usage: sourcecred credrank [options] 

      options:
      -d                    outputs a comparison table between the current graph and the prior graph        
      -s, --simulation      doesn't update the current graph and ledger json
          --stealth         skip the output of the summary table
          --no-zip          write the output as JSON without compressing large files

      Calculate cred scores from existing graph
      `.trimRight()
  );
  return 0;
};

export default credrankCommand;
