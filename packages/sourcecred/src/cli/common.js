// @flow

import {join as pathJoin} from "path";
import {mkdirx} from "../util/disk";
import {loadJson} from "../util/storage";

import {DiskStorage} from "../core/storage/disk";
import type {PluginDirectoryContext} from "../api/plugin";
import {
  parser as configParser,
  type InstanceConfigWithPlugins,
} from "../api/instanceConfigWithPlugins";
import {fromString as verifyPluginId} from "../api/pluginId";

export function loadInstanceConfig(
  baseDir: string
): Promise<InstanceConfigWithPlugins> {
  const storage = new DiskStorage(baseDir);
  const projectFilePath = pathJoin("sourcecred.json");
  return loadJson(storage, projectFilePath, configParser);
}

export function makePluginDir(
  baseDir: string,
  prefix: $ReadOnlyArray<string>,
  pluginId: string
): string {
  const {absolutePath} = _makeDirectories(baseDir, prefix, pluginId);
  return absolutePath;
}

// For use with DataStorage implementations
export function makeRelativePluginDir(
  baseDir: string,
  prefix: $ReadOnlyArray<string>,
  pluginId: string
): string {
  const {relativePath} = _makeDirectories(baseDir, prefix, pluginId);
  return relativePath;
}

function _makeDirectories(
  baseDir: string,
  prefix: $ReadOnlyArray<string>,
  pluginId: string
): {relativePath: string, absolutePath: string} {
  verifyPluginId(pluginId);
  const idParts = pluginId.split("/");

  const [pluginOwner, pluginName] = idParts;
  const pathComponents = [...prefix, pluginOwner, pluginName];
  let path = baseDir;
  for (const pc of pathComponents) {
    path = pathJoin(path, pc);
    mkdirx(path);
  }

  return {absolutePath: path, relativePath: pathJoin(...pathComponents)};
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
