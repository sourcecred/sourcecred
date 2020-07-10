// @flow

import * as NullUtil from "../util/null";
import type {Command} from "./command";
import {loadInstanceConfig, pluginDirectoryContext} from "./common";
import {LoggingTaskReporter} from "../util/taskReporter";
import * as pluginId from "../api/pluginId";

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const loadCommand: Command = async (args, std) => {
  let pluginsToLoad = [];
  const baseDir = process.cwd();
  const config = await loadInstanceConfig(baseDir);
  if (args.length === 0) {
    pluginsToLoad = config.bundledPlugins.keys();
  } else {
    for (const arg of args) {
      const id = pluginId.fromString(arg);
      if (config.bundledPlugins.has(id)) {
        pluginsToLoad.push(id);
      } else {
        return die(
          std,
          `can't find plugin ${id}; remember to use fully scoped name, as in sourcecred/github`
        );
      }
    }
  }
  const taskReporter = new LoggingTaskReporter();
  taskReporter.start("load");
  const failedPlugins = [];
  const loadPromises = [];
  for (const name of pluginsToLoad) {
    const plugin = NullUtil.get(config.bundledPlugins.get(name));
    const task = `loading ${name}`;
    taskReporter.start(task);
    const dirContext = pluginDirectoryContext(baseDir, name);
    const promise = plugin
      .load(dirContext, taskReporter)
      .then(() => taskReporter.finish(task))
      .catch((e) => {
        console.error(e);
        failedPlugins.push(name);
      });
    loadPromises.push(promise);
  }
  await Promise.all(loadPromises);
  taskReporter.finish("load");
  if (failedPlugins.length) {
    return die(std, `load failed for plugins: ${failedPlugins.join(", ")}`);
  }
  return 0;
};

export default loadCommand;
