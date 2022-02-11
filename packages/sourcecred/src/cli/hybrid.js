// @flow

import {LoggingTaskReporter} from "../util/taskReporter";
import type {Command} from "./command";
import dedent from "../util/dedent";
import {LocalInstance} from "../api/instance/localInstance";
import {credequate} from "../api/main/credequate";
import {credrank} from "../api/main/credrank";
import {CredGrainView} from "../core/credGrainView";
import {getEarliestStartForConfigs} from "../core/credequate/config";
import sortBy from "../util/sortBy";
import {sum} from "d3-array";

const hybridCommand: Command = async (args, std) => {
  let isSimulation = false;
  let shouldZipOutput = true;
  args.forEach((arg) => {
    switch (arg) {
      case "--simulation":
      case "-s":
        isSimulation = true;
        break;
      case "--no-zip":
        shouldZipOutput = false;
        break;
    }
  });

  const taskReporter = new LoggingTaskReporter();
  taskReporter.start("hybrid");
  const baseDir = process.cwd();
  const instance = new LocalInstance(baseDir);

  taskReporter.start("hybrid: running credrank");
  const credrankInput = await instance.readCredrankInput();
  const credrankOutput = credrankInput.pluginGraphs.length
    ? await credrank(credrankInput)
    : null;
  taskReporter.finish("hybrid: running credrank");

  taskReporter.start("hybrid: running credequate");
  const credequateInput = await instance.readCredequateInput();
  const credequateOutput = {
    scoredContributions: Array.from(
      credequate(credequateInput).scoredContributions
    ),
  };
  taskReporter.finish("hybrid: running credequate");

  taskReporter.start("hybrid: generating CredGrainView");
  const credGrainViewCE = CredGrainView.fromScoredContributionsAndLedger(
    credequateOutput.scoredContributions,
    credrankOutput?.ledger || credrankInput.ledger,
    getEarliestStartForConfigs(
      credequateInput.rawInstanceConfig.credEquatePlugins.map(
        (p) => p.configsByTarget
      )
    )
  );
  const credGrainViewCR = credrankOutput
    ? CredGrainView.fromCredGraphAndLedger(
        credrankOutput.credGraph,
        credrankOutput.ledger
      )
    : new CredGrainView();
  const credGrainView = CredGrainView.fromCredGrainViews(
    credGrainViewCE,
    credGrainViewCR
  );
  taskReporter.finish("hybrid: generating CredGrainView");

  std.out("\n\n# CredEquate Scores");
  printCredSummaryTable(credGrainViewCE, std);
  std.out("\n\n# CredRank Scores");
  printCredSummaryTable(credGrainViewCR, std);
  std.out("\n\n# Hybrid Scores");
  printCredSummaryTable(credGrainView, std);

  if (!isSimulation) {
    taskReporter.start("writing changes");
    await instance.writeCredequateOutput(credequateOutput, shouldZipOutput);
    if (credrankOutput)
      await instance.writeCredrankOutput(credrankOutput, shouldZipOutput);
    await instance.writeCredGrainView(credGrainView, shouldZipOutput);
    taskReporter.finish("writing changes");
  }

  taskReporter.finish("hybrid");
  return 0;
};

function printCredSummaryTable(credGrainView: CredGrainView, std) {
  std.out(`## Top Participants By Cred`);
  std.out(``);
  std.out(`| Description | Cred | % |`);
  std.out(`| --- | --- | --- |`);
  const credParticipants = Array.from(credGrainView.participants());
  const sortedParticipants = sortBy(credParticipants, (p) => -p.cred);
  const totalCred = sum(sortedParticipants, (p) => p.cred);
  function row({cred, identity}) {
    const percentage = (100 * cred) / totalCred;
    return `| ${identity.name} | ${cred.toFixed(1)} | ${percentage.toFixed(
      1
    )}% |`;
  }
  sortedParticipants.slice(0, 20).forEach((n) => std.out(row(n)));
}

export const hybridHelp: Command = async (args, std) => {
  std.out(
    dedent`\
      usage: sourcecred hybrid [options]

      options:
      -s, --simulation  Skips writing changes to disk.
      --no-zip  Writes the output as JSON without compressing large files

      Run both CredRank and CredEquate and sum the results into one CredGrainView.
      `.trimRight()
  );
  return 0;
};

export default hybridCommand;
