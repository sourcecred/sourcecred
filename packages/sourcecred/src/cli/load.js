// @flow

import * as NullUtil from "../util/null";
import type {Command} from "./command";
import {loadInstanceConfig, pluginDirectoryContext} from "./common";
import {LoggingTaskReporter, ScopedTaskReporter} from "../util/taskReporter";
import {type PluginId, parser as pluginIdParser} from "../api/pluginId";
import {isDirEmpty} from "../util/disk";
import dedent from "../util/dedent";
import fs from "fs-extra";
import chalk from "chalk";

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

function warn(std, task: string, message: string) {
  const label = chalk.bgYellow.bold.white(" WARN ");
  std.err(`${label} ${task}: ${message}`);
}

function fail(std, task: string, message: string = "") {
  const label = chalk.bgRed.bold.white(" FAIL ");
  std.err(`${label} ${task}${message ? `: ${message}` : ""}`);
}

const loadCommand: Command = async (args, std) => {
  let pluginsToLoad: PluginId[] = [];
  const baseDir = process.cwd();
  const config = await loadInstanceConfig(baseDir);
  const combinedPlugins = new Map(config.bundledPlugins);
  config.credEquatePlugins.forEach((plugin) => {
    combinedPlugins.set(plugin.id, plugin.plugin);
  });
  if (args.length === 0) {
    pluginsToLoad = Array.from(combinedPlugins.keys());
    if (pluginsToLoad.length === 0) {
      std.err(
        "No plugins configured; Please set up at least one plugin: " +
          "https://github.com/sourcecred/template-instance#supported-plugins"
      );
    }
  } else {
    for (const arg of args) {
      const id = pluginIdParser.parseOrThrow(arg);
      if (combinedPlugins.has(id)) {
        pluginsToLoad.push(id);
      } else {
        return die(
          std,
          `can't find plugin ${id}; remember to use fully scoped name, as in sourcecred/github`
        );
      }
    }
  }
  const taskReporter = new LoggingTaskReporter(std.out);
  taskReporter.start("load");
  const failedPlugins = [];
  const loadPromises = [];
  const cacheEmpty = new Map<PluginId, boolean>();
  for (const name of pluginsToLoad) {
    const plugin = NullUtil.get(combinedPlugins.get(name));
    const task = `loading ${name}`;
    taskReporter.start(task);
    const dirContext = pluginDirectoryContext(baseDir, name);
    const childTaskReporter = new ScopedTaskReporter(taskReporter, name);

    const loadPlugin = () =>
      plugin
        .load(dirContext, childTaskReporter)
        .then(() => taskReporter.finish(task));

    const endChildRunners = () => {
      // create static array of taskIds from activeTasks map
      Array.from(taskReporter.activeTasks.keys())
        .filter((taskId) => taskId.startsWith(name))
        .forEach((taskId: string) => {
          taskReporter.finish(taskId);
          warn(std, taskId, "Parent task restarting. Retrying");
        });
    };

    const restartParentRunner = (error: string) => {
      taskReporter.finish(task);
      warn(
        std,
        task,
        `Error updating cache. clearing cache and restarting.
        This is the error from the plugin:\n
        ${error}`
      );
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
        const output = e instanceof Error ? e : JSON.stringify(e);
        fail(std, name, output);
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

export const loadHelp: Command = async (args, std) => {
  std.out(
    dedent`\
      usage: sourcecred load

      Load user activity into the cache via plugins

      load pulls user data from each plugin listed in sourcecred.json
      `.trimRight()
  );
  return 0;
};

export default loadCommand;
