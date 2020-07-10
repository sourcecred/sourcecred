// @flow

import {join as pathJoin} from "path";
import {loadJson, mkdirx} from "../util/disk";

import type {PluginDirectoryContext} from "../api/plugin";
import {
  parser as configParser,
  type InstanceConfig,
} from "../api/instanceConfig";

export function loadInstanceConfig(baseDir: string): Promise<InstanceConfig> {
  const projectFilePath = pathJoin(baseDir, "sourcecred.json");
  return loadJson(projectFilePath, configParser);
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
  const configDir = makePluginDir(baseDir, ["config", "plugins"], pluginName);
  return {
    configDirectory() {
      return configDir;
    },
    cacheDirectory() {
      return cacheDir;
    },
  };
}
