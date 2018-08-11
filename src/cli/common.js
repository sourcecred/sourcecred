// @flow

import {flags} from "@oclif/command";
import os from "os";
import path from "path";

export type PluginName = "github" | "git";
export function pluginNames(): PluginName[] {
  return ["github", "git"];
}

export function defaultPlugins(): PluginName[] {
  return ["github"];
}

function defaultStorageDirectory() {
  return path.join(os.tmpdir(), "sourcecred");
}

export function sourcecredDirectoryFlag() {
  return flags.string({
    char: "d",
    description: "directory for storing graphs and other SourceCred data",
    env: "SOURCECRED_DIRECTORY",
    default: () => defaultStorageDirectory(),
  });
}

export function nodeMaxOldSpaceSizeFlag() {
  return flags.integer({
    description: "--max_old_space_size flag to node; increases available heap",
    default: 8192,
    env: "SOURCECRED_NODE_MAX_OLD_SPACE",
  });
}
