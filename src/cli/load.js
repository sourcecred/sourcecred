// @flow

import * as NullUtil from "../util/null";
import type {Command} from "./command";
import {loadInstanceConfig, pluginDirectoryContext} from "./common";
import {LoggingTaskReporter} from "../util/taskReporter";
import {type PluginId, parser as pluginIdParser} from "../api/pluginId";
import {isDirEmpty} from "../util/disk";
import fs from "fs-extra";
import chalk from "chalk";

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

function warn(std, task: string, message: string) {
  const label = chalk.bgYellow.bold.white(" WARN ");
  std.out(`${label} ${task}: ${message}`);
}

const loadCommand: Command = async (args, std) => {
  let pluginsToLoad: PluginId[] = [];
  const baseDir = process.cwd();
  const config = await loadInstanceConfig(baseDir);
  if (args.length === 0) {
    pluginsToLoad = Array.from(config.bundledPlugins.keys());
  } else {
    for (const arg of args) {
      const id = pluginIdParser.parseOrThrow(arg);
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
  const cacheEmpty = new Map<PluginId, boolean>();
  for (const name of pluginsToLoad) {
    const plugin = NullUtil.get(config.bundledPlugins.get(name));
    const task = `loading ${name}`;
    taskReporter.start(task);
    const dirContext = pluginDirectoryContext(baseDir, name);
    const childTaskReporter = new LoggingTaskReporter({scopedPrefix: name});

    const loadPlugin = () =>
      plugin
        .load(dirContext, childTaskReporter)
        .then(() => taskReporter.finish(task));

    const endChildRunners = () => {
      console.log("[debug] activeTasks: ", childTaskReporter.activeTasks);
      Array.from(childTaskReporter.activeTasks.keys()).forEach(
        (taskKey: string) => {
          console.log("[debug] killing: ", taskKey);
          childTaskReporter.finish(taskKey);
          warn(std, taskKey, "Retrying");
        }
      );
    };

    const restartParentRunner = (error: string) => {
      taskReporter.finish(task);
      warn(std, task, `${error}; clearing cache`);
      taskReporter.start(task);
    };

    cacheEmpty.set(name, isDirEmpty(dirContext.cacheDirectory()));
    const loadWithPossibleRetry = loadPlugin()
      .catch((e) => {
        if (!cacheEmpty.get(name)) {
          // remove child runner entries
          endChildRunners();
          restartParentRunner(e);
          // clear the cache and try again
          fs.emptyDirSync(dirContext.cacheDirectory());
          return loadPlugin();
        }
        throw e;
      })
      .catch((e) => {
        console.error(e);
        failedPlugins.push(name);
      });
    loadPromises.push(loadWithPossibleRetry);
  }
  await Promise.all(loadPromises);
  taskReporter.finish("load");
  if (failedPlugins.length) {
    return die(std, `load failed for plugins: ${failedPlugins.join(", ")}`);
  }
  return 0;
};

export default loadCommand;
