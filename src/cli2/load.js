// @flow
// Implementation of `sourcecred load`

import fs from "fs-extra";
import {join as pathJoin} from "path";

import {parse as parseConfig, type InstanceConfig} from "./instanceConfig";
import {bundledPlugins} from "./bundledCliPlugins";
import {PluginDirectoryContext, type CliPlugin} from "./cliPlugin";

import dedent from "../util/dedent";
import {LoggingTaskReporter} from "../util/taskReporter";
import type {Command} from "./command";
import * as Common from "./common";
import * as Weights from "../core/weights";
import {projectFromJSON} from "../core/project";
import {load} from "../api/load";
import {specToProject} from "../plugins/github/specToProject";
import {type PluginDeclaration} from "../analysis/pluginDeclaration";
import {declaration as discourseDeclaration} from "../plugins/discourse/declaration";
import {declaration as githubDeclaration} from "../plugins/github/declaration";
import {declaration as identityDeclaration} from "../plugins/identity/declaration";
import {defaultParams} from "../analysis/timeline/params";

function usage(print: (string) => void): void {
  print("usage: sourcecred load");
  // TODO: Load for a particular plugin by passing its name.
}

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

async function loadConfig(baseDir: string): Promise<InstanceConfig> {
  const path = pathJoin(baseDir, "sourcecred.json");
  const contents = await fs.readFile(path);
  return Promise.resolve(parseConfig(JSON.parse(contents)));
}

function mkdirx(path: string) {
  try {
    fs.mkdirSync(path);
  } catch (e) {
    if (e.code !== "EEXIST") {
      throw e;
    }
  }
}

function pluginDirectoryContext(
  baseDir: string,
  pluginId: string
): PluginDirectoryContext {
  const idParts = pluginId.split("/");
  if (idParts.length !== 2) {
    throw new Error(`Bad plugin name: ${pluginId}`);
  }
  const [pluginOwner, pluginName] = idParts;
  function makeDirs(kind: string) {
    const kindDir = pathJoin(baseDir, kind);
    mkdirx(kindDir);
    const ownerDir = pathJoin(kindDir, pluginOwner);
    mkdirx(ownerDir);
    const pluginDir = pathJoin(ownerDir, pluginName);
    mkdirx(pluginDir);
    return pluginDir;
  }
  const cacheDir = makeDirs("cache");
  const configDir = makeDirs("config");
  return {
    configDirectory() {
      return configDir;
    },
    cacheDirectory() {
      return cacheDir;
    },
  };
}

const loadCommand: Command = async (args, std) => {
  const baseDir = process.cwd();
  const config = await loadConfig(baseDir);
  const pluginIds = config.bundledPlugins;
  const allBundledPlugins = bundledPlugins();
  const plugins = pluginIds.map((name) => {
    const plugin = allBundledPlugins[name];
    if (plugin == null) {
      throw new Error(`Unknown plugin: ${name}`);
    }
    return {name, plugin};
  });
  for (const plugin of plugins) {
    const dirContext = pluginDirectoryContext(baseDir, plugin.name);
    plugin.plugin.load(dirContext);
  }
  return 0;
};

export default loadCommand;
