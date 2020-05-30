// @flow

import type {Command} from "./command";
import {loadInstanceConfig, pluginDirectoryContext} from "./common";
import {LoggingTaskReporter} from "../util/taskReporter";

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const loadCommand: Command = async (args, std) => {
  if (args.length !== 0) {
    die(std, "usage: sourcecred load");
  }
  const taskReporter = new LoggingTaskReporter();
  taskReporter.start("load");
  const baseDir = process.cwd();
  const config = await loadInstanceConfig(baseDir);
  const loadPromises = [];
  for (const [name, plugin] of config.bundledPlugins) {
    const task = `loading ${name}`;
    taskReporter.start(task);
    const dirContext = pluginDirectoryContext(baseDir, name);
    const promise = plugin
      .load(dirContext, taskReporter)
      .then(() => taskReporter.finish(task));
    loadPromises.push(promise);
  }
  await Promise.all(loadPromises);
  taskReporter.finish("load");
  return 0;
};

export default loadCommand;
