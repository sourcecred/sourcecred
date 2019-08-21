// @flow
// Configuration and environment variables used by the CLI.

import os from "os";
import path from "path";
import deepFreeze from "deep-freeze";

import * as NullUtil from "../util/null";

export type PluginName = "git" | "github";

export const defaultPlugins: PluginName[] = deepFreeze(["github"]);

export function defaultSourcecredDirectory() {
  return path.join(os.tmpdir(), "sourcecred");
}

export function sourcecredDirectory(): string {
  const env = process.env.SOURCECRED_DIRECTORY;
  return env != null ? env : defaultSourcecredDirectory();
}

export function githubToken(): string | null {
  return NullUtil.orElse(process.env.SOURCECRED_GITHUB_TOKEN, null);
}

export function discourseKey(): string | null {
  return NullUtil.orElse(process.env.SOURCECRED_DISCOURSE_KEY, null);
}
