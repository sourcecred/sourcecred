// @flow

import * as NullUtil from "../util/null";
import type {Command} from "./command";
import {loadInstanceConfig, pluginDirectoryContext} from "./common";
import {LoggingTaskReporter} from "../util/taskReporter";
import * as pluginId from "../api/pluginId";
import {Plugin, PluginDirectoryContext} from "../api/plugin";
import {isDirEmpty} from "../util/disk";
import fs from "fs-extra";

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

type PluginLoadContext = {|
  +plugin: Plugin,
  +dirContext: PluginDirectoryContext,
  +taskReporter: LoggingTaskReporter,
  +task: string,
|};

function loadPlugin(ctx: PluginLoadContext) {
  const {plugin, dirContext, taskReporter, task} = ctx;
  return plugin
    .load(dirContext, taskReporter)
    .then(() => taskReporter.finish(task));
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
  const cacheEmpty = new Map<pluginId.PluginId, boolean>();
  for (const name of pluginsToLoad) {
    const plugin = NullUtil.get(config.bundledPlugins.get(name));
    const task = `loading ${name}`;
    taskReporter.start(task);
    const dirContext = pluginDirectoryContext(baseDir, name);
    cacheEmpty.set(name, isDirEmpty(dirContext.cacheDirectory()));
    const pluginCtx: PluginLoadContext = {
      plugin,
      dirContext,
      taskReporter,
      task,
    };
    const promise = loadPlugin(pluginCtx)
      .catch((e) => {
        if (!cacheEmpty.get(name)) {
          // clear the cache and try again
          fs.emptyDirSync(dirContext.cacheDirectory());
          return loadPlugin(pluginCtx);
        }
        throw e;
      })
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
