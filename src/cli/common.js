// @flow
// Configuration and environment variables used by the CLI.

import os from "os";
import path from "path";
import deepFreeze from "deep-freeze";
import fs from "fs-extra";
import {type Weights, fromJSON as weightsFromJSON} from "../analysis/weights";
import {validateToken, type GithubToken} from "../plugins/github/token";

export type PluginName = "git" | "github";

export const defaultPlugins: PluginName[] = deepFreeze(["github"]);

export function defaultSourcecredDirectory() {
  return path.join(os.tmpdir(), "sourcecred");
}

export function sourcecredDirectory(): string {
  const env = process.env.SOURCECRED_DIRECTORY;
  return env != null ? env : defaultSourcecredDirectory();
}

export function githubToken(): ?GithubToken {
  const envToken = process.env.SOURCECRED_GITHUB_TOKEN;
  if (envToken == null || !envToken.length) {
    return null;
  }
  return validateToken(envToken);
}

export async function loadWeights(path: string): Promise<Weights> {
  if (!(await fs.exists(path))) {
    throw new Error("Could not find the weights file");
  }
  const raw = await fs.readFile(path, "utf-8");
  const weightsJSON = JSON.parse(raw);
  try {
    return weightsFromJSON(weightsJSON);
  } catch (e) {
    throw new Error(`provided weights file is invalid:\n${e}`);
  }
}
