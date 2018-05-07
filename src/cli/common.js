// @flow

import os from "os";
import path from "path";

export type PluginName = "git" | "github";
export function pluginNames() {
  return ["git", "github"];
}

export function defaultStorageDirectory() {
  return path.join(os.tmpdir(), "sourcecred");
}
