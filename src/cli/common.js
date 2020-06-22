// @flow

import {join as pathJoin} from "path";
import fs from "fs-extra";

import type {PluginDirectoryContext} from "./cliPlugin";
import {parse as parseConfig, type InstanceConfig} from "./instanceConfig";
import * as C from "../util/combo";

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

/**
 * Load and parse a JSON file from disk.
 *
 * If the file cannot be read, then an error is thrown.
 * If parsing fails, an error is thrown.
 */
export async function loadJson<T>(
  path: string,
  parser: C.Parser<T>
): Promise<T> {
  const contents = await fs.readFile(path);
  return parser.parseOrThrow(JSON.parse(contents));
}

/**
 * Load and parse a JSON file from disk, with a default to use if the file is
 * not found.
 *
 * This is intended as a convenience for situations where the user may
 * optionally provide configuration in a json file saved to disk.
 *
 * The default must be provided as a function that returns a default, to
 * accommodate situations where the object may be mutable, or where constructing
 * the default may be expensive.
 *
 * If no file is present at that location, then the default constructor is
 * invoked to create a default value, and that is returned.
 *
 * If attempting to load the file fails for any reason other than ENOENT
 * (e.g. the path actually is a directory), then the error is thrown.
 *
 * If parsing fails, an error is thrown.
 */
export async function loadJsonWithDefault<T>(
  path: string,
  parser: C.Parser<T>,
  def: () => T
): Promise<T> {
  try {
    const contents = await fs.readFile(path);
    return parser.parseOrThrow(JSON.parse(contents));
  } catch (e) {
    if (e.code === "ENOENT") {
      return def();
    } else {
      throw e;
    }
  }
}
