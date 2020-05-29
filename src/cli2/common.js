// @flow

import {join as pathJoin} from "path";
import fs from "fs-extra";

import type {PluginDirectoryContext} from "./cliPlugin";
import {parse as parseConfig, type InstanceConfig} from "./instanceConfig";

export async function loadInstanceConfig(
  baseDir: string
): Promise<InstanceConfig> {
  const projectFilePath = pathJoin(baseDir, "sourcecred.json");
  const contents = await fs.readFile(projectFilePath);
  return Promise.resolve(parseConfig(JSON.parse(contents)));
}

// Make a directory, if it doesn't exist.
function mkdirx(path: string) {
  try {
    fs.mkdirSync(path);
  } catch (e) {
    if (e.code !== "EEXIST") {
      throw e;
    }
  }
}

export function makePluginDir(
  baseDir: string,
  prefix: $ReadOnlyArray<string>,
  pluginId: string
): string {
  const idParts = pluginId.split("/");
  if (idParts.length !== 2) {
    throw new Error(`Bad plugin name: ${pluginId}`);
  }
  const [pluginOwner, pluginName] = idParts;
  const pathComponents = [...prefix, pluginOwner, pluginName];
  let path = baseDir;
  for (const pc of pathComponents) {
    path = pathJoin(path, pc);
    mkdirx(path);
  }
  return path;
}

export function pluginDirectoryContext(
  baseDir: string,
  pluginName: string
): PluginDirectoryContext {
  const cacheDir = makePluginDir(baseDir, ["cache"], pluginName);
  const configDir = makePluginDir(baseDir, ["config"], pluginName);
  return {
    configDirectory() {
      return configDir;
    },
    cacheDirectory() {
      return cacheDir;
    },
  };
}
