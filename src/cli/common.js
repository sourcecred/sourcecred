// @flow

import {flags} from "@oclif/command";
import os from "os";
import path from "path";

export type PluginName = "git" | "github";
export function pluginNames() {
  return ["git", "github"];
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
