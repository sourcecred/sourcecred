// @flow

import {LoggingTaskReporter} from "../util/taskReporter";
import type {Command} from "./command";
import dedent from "../util/dedent";
import * as pluginId from "../api/pluginId";
import {Instance} from "../api/instance/instance";
import {LocalInstance} from "../api/instance/localInstance";
import {contributions} from "../api/main/contributions";

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const contributionsCommand: Command = async (args, std) => {
  let isSimulation = false;
  let shouldZipOutput = true;
  const processedArgs = args.filter((arg) => {
    switch (arg) {
      case "--simulation":
      case "-s":
        isSimulation = true;
        return false;
      case "--no-zip":
        shouldZipOutput = false;
        return false;
      default:
        return true;
    }
  });

  const taskReporter = new LoggingTaskReporter();
  taskReporter.start("contributions");
  const baseDir = process.cwd();
  const instance: Instance = await new LocalInstance(baseDir);
  const contributionsInput = await instance.readContributionsInput();

  const availablePlugins = contributionsInput.plugins.map(
    ({pluginId}) => pluginId
  );
  let pluginsToLoad = [];

  if (processedArgs.length === 0) {
    pluginsToLoad = contributionsInput.plugins;
  } else {
    const pluginIdsToLoad = processedArgs.map((arg) => {
      const id = pluginId.fromString(arg);
      if (!availablePlugins.includes(id)) {
        return die(
          std,
          `can't find plugin ${id}; remember to use fully scoped name, as in sourcecred/github`
        );
      }
      return id;
    });
    pluginsToLoad = contributionsInput.plugins.filter((plugin) => {
      pluginIdsToLoad.includes(plugin.pluginId);
    });
  }

  const contributionsOutput = await contributions(
    {...contributionsInput, plugins: pluginsToLoad},
    taskReporter
  );

  if (!isSimulation) {
    taskReporter.start("writing files");
    await instance.writeContributionsOutput(
      contributionsOutput,
      shouldZipOutput
    );
    taskReporter.finish("writing files");
  }
  taskReporter.finish("contributions");
  return 0;
};

export const contributionsHelp: Command = async (args, std) => {
  std.out(
    dedent`\
      usage: sourcecred contributions [options]

      options:
      -s, --simulation  Skips writing changes to the contributions and ledger jsons.
      --no-zip  Writes the output as JSON without compressing large files

      Generate a contributions list from cached plugin data

      Either 'sourcecred load' must immediately precede this command or
      a cache directory must exist for all plugins specified in sourcecred.json
      `.trimRight()
  );
  return 0;
};

export default contributionsCommand;
