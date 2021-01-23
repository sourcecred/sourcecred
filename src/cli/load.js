// @flow

import * as NullUtil from "../util/null";
import type {Command} from "./command";
import {loadInstanceConfig, pluginDirectoryContext} from "./common";
import {LoggingTaskReporter} from "../util/taskReporter";
import {TaskManager} from "../util/taskManager";
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
  if (args.length === 0) {
    pluginsToLoad = Array.from(config.bundledPlugins.keys());
    if (pluginsToLoad.length === 0) {
      std.err(
        "No plugins configured; Please set up at least one plugin: " +
          "https://github.com/sourcecred/template-instance#supported-plugins"
      );
    }
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
  const taskReporter = new LoggingTaskReporter(std.out);
  const manager = new TaskManager(taskReporter);
  manager.start("load");
  const failedPlugins = [];
  const loadPromises = [];
  const cacheEmpty = new Map<PluginId, boolean>();
  for (const name of pluginsToLoad) {
    const plugin = NullUtil.get(config.bundledPlugins.get(name));
    const task = `loading ${name}`;
    const scopedManager = manager.start(task);
    const dirContext = pluginDirectoryContext(baseDir, name);

    const loadPlugin = () =>
      plugin.load(dirContext, scopedManager).then(() => manager.finish(task));

    const restartParentRunner = (error: string) => {
      manager.finish(task);
      warn(std, task, `clearing cache: ${error}`);
      manager.start(task);
    };

    cacheEmpty.set(name, isDirEmpty(dirContext.cacheDirectory()));
    const loadWithPossibleRetry = loadPlugin()
      .catch((e) => {
        if (!cacheEmpty.get(name)) {
          restartParentRunner(e);
          // clear the cache and try again
          fs.emptyDirSync(dirContext.cacheDirectory());
          return loadPlugin();
        }
        throw e;
      })
      .catch((e) => {
        fail(std, name, e);
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
