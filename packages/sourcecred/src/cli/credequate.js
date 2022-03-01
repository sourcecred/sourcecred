// @flow

import {LoggingTaskReporter} from "../util/taskReporter";
import type {Command} from "./command";
import dedent from "../util/dedent";
import {LocalInstance} from "../api/instance/localInstance";
import {credequate, dependencies} from "../api/main/credequate";
import {CredGrainView} from "../core/credGrainView";
import {getEarliestStartForConfigs} from "../core/credequate/config";
import sortBy from "../util/sortBy";
import {sum} from "d3-array";

const credequateCommand: Command = async (args, std) => {
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
  taskReporter.start("credequate");
  const baseDir = process.cwd();
  const instance = new LocalInstance(baseDir);
  const credequateInput = await instance.readCredequateInput();
  const credequateOutput = {
    scoredContributions: Array.from(
      credequate(credequateInput).scoredContributions
    ),
  };

  const earliestStart = getEarliestStartForConfigs(
    credequateInput.rawInstanceConfig.credEquatePlugins.map(
      (p) => p.configsByTarget
    )
  );
  const credGrainView = CredGrainView.fromScoredContributionsAndLedger(
    credequateOutput.scoredContributions,
    await instance.readLedger(),
    earliestStart
  );
  const dependenciesInput = {
    credGrainView,
    ledger: await instance.readLedger(),
    dependencies: await instance.readDependencies(),
  };
  const dependenciesOutput = dependencies(dependenciesInput);
  credequateOutput.scoredContributions = credequateOutput.scoredContributions.concat(
    dependenciesOutput.scoredDependencyContributions
  );

  printCredSummaryTable(dependenciesOutput.credGrainView, std);

  if (!isSimulation) {
    taskReporter.start("writing changes");
    instance.writeCredequateOutput(credequateOutput, shouldZipOutput);
    instance.writeCredGrainView(
      dependenciesOutput.credGrainView,
      shouldZipOutput
    );
    instance.writeDependenciesConfig(dependenciesOutput.dependencies);
    instance.writeLedger(dependenciesOutput.ledger);
    taskReporter.finish("writing changes");
  }

  taskReporter.finish("credequate");
  return 0;
};

function printCredSummaryTable(credGrainView: CredGrainView, std) {
  std.out(`# Top Participants By Cred`);
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

export const credequateHelp: Command = async (args, std) => {
  std.out(
    dedent`\
      usage: sourcecred credequate [options]

      options:
      -s, --simulation  Skips writing changes to disk.
      --no-zip  Writes the output as JSON without compressing large files

      Generate a scored contributions list from plugin contributions
      `.trimRight()
  );
  return 0;
};

export default credequateCommand;
